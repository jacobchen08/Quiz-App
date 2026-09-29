import asyncio
import json
import secrets
import time

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from trivia import TriviaError, fetch_questions, prepare_question, public_question

# Multiplayer flow:
# 1. POST /api/rooms creates a room and returns its code.
# 2. Each player opens a WebSocket to /api/ws/{code} and sends {"type": "join", "name": ...}.
#    The server answers with {"type": "welcome", "playerId", "token"}. The first player is the host.
# 3. The host sends {"type": "start", "settings": {...}}; everyone receives the same questions.
# 4. Players send {"type": "answer", "index": i, "answer": "..."}; the server checks it
#    (correct answers are never sent to the browser before answering) and broadcasts the scores.
# 5. {"type": "leave"} gives up your seat straight away.
#
# Reconnecting: if a socket drops without "leave" (a phone switching apps, a flaky network),
# the player's seat is held for RECONNECT_GRACE seconds. Joining again with
# {"type": "join", "token": ...} puts them back in their seat with their answers and score.
#
# Scoring: a correct answer is worth BASE_POINTS plus a speed bonus of up to SPEED_BONUS,
# measured from the start of the game or the player's previous answer. Streaks count
# correct answers in a row.
#
# Rooms live in memory, so they disappear if the server restarts.

router = APIRouter(prefix="/api")

ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I to avoid confusion
ROOM_CODE_LENGTH = 5
MAX_PLAYERS = 20
EMPTY_ROOM_TTL = 10 * 60  # seconds a created room can sit with nobody in it
RECONNECT_GRACE = 90  # seconds a disconnected player's seat is held for them

BASE_POINTS = 100
SPEED_BONUS = 50
BONUS_FULL_SECONDS = 5  # answer within this long for the whole bonus
BONUS_ZERO_SECONDS = 20  # after this long there's no bonus left

rooms = {}
_seat_timers = set()  # keeps pending seat-expiry tasks alive until they run


def speed_bonus(elapsed):
    """Bonus points for a correct answer given `elapsed` seconds after the previous one."""
    if elapsed <= BONUS_FULL_SECONDS:
        return SPEED_BONUS
    if elapsed >= BONUS_ZERO_SECONDS:
        return 0
    remaining = (BONUS_ZERO_SECONDS - elapsed) / (BONUS_ZERO_SECONDS - BONUS_FULL_SECONDS)
    return round(SPEED_BONUS * remaining)


class Player:
    def __init__(self, name, ws):
        self.id = secrets.token_hex(4)
        self.token = secrets.token_urlsafe(16)  # proves who you are when you reconnect
        self.name = name
        self.ws = ws
        self.connected = True
        self.left_at = None
        self.reset()

    def reset(self):
        self.score = 0  # points
        self.correct = 0
        self.streak = 0
        self.best_streak = 0
        self.answers = {}  # question index -> {"answer", "correct", "points"}
        self.last_answer_at = time.time()

    def record(self, index, answer, correct, now):
        """Store an answer and return the points it earned."""
        elapsed = now - self.last_answer_at
        self.last_answer_at = now
        points = BASE_POINTS + speed_bonus(elapsed) if correct else 0
        self.answers[index] = {"answer": answer, "correct": correct, "points": points}
        if correct:
            self.score += points
            self.correct += 1
            self.streak += 1
            self.best_streak = max(self.best_streak, self.streak)
        else:
            self.streak = 0
        return points


class Room:
    def __init__(self, code):
        self.code = code
        self.players = {}
        self.host_id = None
        self.status = "lobby"  # lobby -> loading -> playing -> finished
        self.questions = []
        self.round = 0  # goes up with every game, so clients can tell a new game from a resend
        self.created_at = time.time()

    def connected_players(self):
        return [p for p in self.players.values() if p.connected]

    def find_by_token(self, token):
        if not token:
            return None
        return next((p for p in self.players.values() if secrets.compare_digest(p.token, str(token))), None)

    def pass_host_if_needed(self):
        """Keep a connected host whenever anyone is connected."""
        host = self.players.get(self.host_id)
        if host is not None and host.connected:
            return
        active = self.connected_players()
        if active:
            self.host_id = active[0].id
        elif host is None:
            self.host_id = next(iter(self.players), None)

    def state_message(self):
        players = sorted(self.players.values(), key=lambda p: (-p.score, -p.correct, p.name.lower()))
        return {
            "type": "state",
            "code": self.code,
            "status": self.status,
            "hostId": self.host_id,
            "questionCount": len(self.questions),
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "score": p.score,
                    "correct": p.correct,
                    "streak": p.streak,
                    "bestStreak": p.best_streak,
                    "answered": len(p.answers),
                    "connected": p.connected,
                }
                for p in players
            ],
        }

    def questions_message(self):
        # Everything except the correct answers
        return {
            "type": "questions",
            "round": self.round,
            "questions": [public_question(q) for q in self.questions],
        }

    def answers_message(self, player):
        """A returning player's own answers, so their screen can pick up where it was."""
        return {
            "type": "answers",
            "round": self.round,
            "results": [
                {
                    "index": index,
                    "answer": a["answer"],
                    "correct": a["correct"],
                    "correctAnswer": self.questions[index]["correct"],
                    "points": a["points"],
                }
                for index, a in sorted(player.answers.items())
            ],
        }

    def everyone_finished(self):
        # Only players who are here right now: nobody waits on a seat that's being held
        total = len(self.questions)
        active = self.connected_players()
        return total > 0 and bool(active) and all(len(p.answers) == total for p in active)

    async def broadcast(self, message):
        for player in self.connected_players():
            try:
                await player.ws.send_json(message)
            except Exception:
                pass  # that player's disconnect is handled by their own socket loop


def new_room_code():
    while True:
        code = "".join(secrets.choice(ROOM_CODE_CHARS) for _ in range(ROOM_CODE_LENGTH))
        if code not in rooms:
            return code


def prune_empty_rooms():
    now = time.time()
    for code, room in list(rooms.items()):
        if not room.players and now - room.created_at > EMPTY_ROOM_TTL:
            del rooms[code]


def remove_player(room, player):
    room.players.pop(player.id, None)
    if not room.players:
        rooms.pop(room.code, None)
    else:
        room.pass_host_if_needed()


def expire_seat(room, player, now=None):
    """Give up a disconnected player's seat once the grace period is over. True if removed."""
    now = time.time() if now is None else now
    if player.connected or room.players.get(player.id) is not player or player.left_at is None:
        return False
    if now - player.left_at < RECONNECT_GRACE:
        return False
    remove_player(room, player)
    return True


async def settle(room):
    """Finish the game if everyone here is done, then tell everyone the new state."""
    if room.status == "playing" and room.everyone_finished():
        room.status = "finished"
    await room.broadcast(room.state_message())


async def expire_seat_later(room, player):
    await asyncio.sleep(RECONNECT_GRACE)
    if expire_seat(room, player) and room.code in rooms:
        await settle(room)


async def hold_seat(room, player):
    """The player's socket closed without "leave": keep their seat for a while."""
    player.connected = False
    player.left_at = time.time()
    player.ws = None
    room.pass_host_if_needed()
    await settle(room)
    task = asyncio.create_task(expire_seat_later(room, player))
    _seat_timers.add(task)
    task.add_done_callback(_seat_timers.discard)


@router.post("/rooms")
def create_room():
    prune_empty_rooms()
    room = Room(new_room_code())
    rooms[room.code] = room
    return {"code": room.code}


@router.get("/rooms/{code}")
def get_room(code: str):
    room = rooms.get(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"code": room.code, "status": room.status, "playerCount": len(room.players)}


async def start_game(room, settings):
    room.status = "loading"
    await room.broadcast(room.state_message())
    try:
        raw = await asyncio.to_thread(
            fetch_questions,
            settings.get("amount", 10),
            settings.get("category") or "all",
            settings.get("difficulty") or "all",
            settings.get("type") or "all",
        )
    except TriviaError as e:
        room.status = "lobby" if not room.questions else "finished"
        await room.broadcast({"type": "error", "message": str(e)})
        await room.broadcast(room.state_message())
        return

    room.questions = [prepare_question(q) for q in raw]
    room.round += 1
    for player in room.players.values():
        player.reset()
    room.status = "playing"
    await room.broadcast(room.questions_message())
    await room.broadcast(room.state_message())


async def submit_answer(room, player, index, answer):
    if room.status != "playing":
        return
    if not isinstance(index, int) or not 0 <= index < len(room.questions):
        return
    if index in player.answers:
        return

    question = room.questions[index]
    correct = answer == question["correct"]
    points = player.record(index, answer, correct, time.time())

    await player.ws.send_json({
        "type": "answer_result",
        "index": index,
        "answer": answer,
        "correct": correct,
        "correctAnswer": question["correct"],
        "points": points,
        "streak": player.streak,
    })
    await settle(room)


async def handle_message(room, player, message):
    kind = message.get("type")
    if kind == "start":
        if player.id == room.host_id and room.status in ("lobby", "finished"):
            await start_game(room, message.get("settings") or {})
    elif kind == "answer":
        await submit_answer(room, player, message.get("index"), message.get("answer"))


async def receive_message(ws):
    try:
        message = json.loads(await ws.receive_text())
    except ValueError:
        return {}
    return message if isinstance(message, dict) else {}


async def refuse(ws, code, message):
    await ws.send_json({"type": "error", "code": code, "message": message})
    await ws.close()


@router.websocket("/ws/{code}")
async def room_socket(ws: WebSocket, code: str):
    await ws.accept()

    room = rooms.get(code.upper())
    if room is None:
        await refuse(ws, "room_not_found", "Room not found. Check the code and try again.")
        return

    # First message must be the join message: a name, plus a token when reconnecting
    try:
        join = await receive_message(ws)
    except WebSocketDisconnect:
        return
    if rooms.get(room.code) is not room:  # the room closed while we waited
        await refuse(ws, "room_not_found", "That room has closed.")
        return

    player = room.find_by_token(join.get("token"))
    if player is not None:
        # Back in their held seat; a newer connection replaces an older one
        old_ws = player.ws
        player.ws = ws
        player.connected = True
        player.left_at = None
        if old_ws is not None:
            try:
                await old_ws.close()
            except Exception:
                pass
    else:
        if len(room.players) >= MAX_PLAYERS:
            await refuse(ws, "room_full", "That room is full.")
            return
        name = str(join.get("name", "")).strip()[:20] or "Player"
        player = Player(name, ws)
        room.players[player.id] = player
    room.pass_host_if_needed()

    leaving = False
    try:
        await ws.send_json({"type": "welcome", "playerId": player.id, "token": player.token})
        if room.status in ("playing", "finished"):
            await ws.send_json(room.questions_message())
            await ws.send_json(room.answers_message(player))
        await room.broadcast(room.state_message())

        while True:
            message = await receive_message(ws)
            if message.get("type") == "leave":
                leaving = True
                break
            await handle_message(room, player, message)
    except WebSocketDisconnect:
        pass
    finally:
        if player.ws is ws:  # skip if a newer connection has taken over this seat
            if leaving:
                remove_player(room, player)
                if room.code in rooms:
                    await settle(room)
            else:
                await hold_seat(room, player)
