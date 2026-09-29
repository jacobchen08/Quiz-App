import asyncio
import html
import json
import random
import secrets
import time

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from trivia import TriviaError, fetch_questions

# Multiplayer flow:
# 1. POST /api/rooms creates a room and returns its code.
# 2. Each player opens a WebSocket to /api/ws/{code} and sends {"type": "join", "name": ...}.
#    The first player to join is the host.
# 3. The host sends {"type": "start", "settings": {...}}; everyone receives the same questions.
# 4. Players send {"type": "answer", "index": i, "answer": "..."}; the server checks it
#    (correct answers are never sent to the browser before answering) and broadcasts the scores.
#
# Rooms live in memory, so they disappear if the server restarts.

router = APIRouter(prefix="/api")

ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I to avoid confusion
ROOM_CODE_LENGTH = 5
MAX_PLAYERS = 20
EMPTY_ROOM_TTL = 10 * 60  # seconds a created room can sit with nobody in it

rooms = {}


class Player:
    def __init__(self, name, ws):
        self.id = secrets.token_hex(4)
        self.name = name
        self.ws = ws
        self.score = 0
        self.answers = {}  # question index -> answer the player picked


class Room:
    def __init__(self, code):
        self.code = code
        self.players = {}
        self.host_id = None
        self.status = "lobby"  # lobby -> loading -> playing -> finished
        self.questions = []
        self.created_at = time.time()

    def state_message(self):
        players = sorted(self.players.values(), key=lambda p: (-p.score, p.name.lower()))
        return {
            "type": "state",
            "code": self.code,
            "status": self.status,
            "hostId": self.host_id,
            "questionCount": len(self.questions),
            "players": [
                {"id": p.id, "name": p.name, "score": p.score, "answered": len(p.answers)}
                for p in players
            ],
        }

    def questions_message(self):
        # Everything except the correct answer
        return {
            "type": "questions",
            "questions": [
                {k: q[k] for k in ("question", "category", "type", "options")}
                for q in self.questions
            ],
        }

    def everyone_finished(self):
        total = len(self.questions)
        return total > 0 and all(len(p.answers) == total for p in self.players.values())

    async def broadcast(self, message):
        for player in list(self.players.values()):
            try:
                await player.ws.send_json(message)
            except Exception:
                pass  # that player's disconnect is handled by their own socket loop


def prepare_question(raw):
    correct = html.unescape(raw["correct_answer"])
    if raw["type"] == "multiple":
        # shuffle once on the server so every player sees the same order
        options = [correct] + [html.unescape(a) for a in raw["incorrect_answers"]]
        random.shuffle(options)
    else:
        options = ["True", "False"]
    return {
        "question": html.unescape(raw["question"]),
        "category": html.unescape(raw["category"]),
        "type": raw["type"],
        "options": options,
        "correct": correct,
    }


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
    for player in room.players.values():
        player.score = 0
        player.answers = {}
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
    player.answers[index] = answer
    if correct:
        player.score += 1

    await player.ws.send_json({
        "type": "answer_result",
        "index": index,
        "answer": answer,
        "correct": correct,
        "correctAnswer": question["correct"],
    })
    if room.everyone_finished():
        room.status = "finished"
    await room.broadcast(room.state_message())


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


@router.websocket("/ws/{code}")
async def room_socket(ws: WebSocket, code: str):
    await ws.accept()

    room = rooms.get(code.upper())
    if room is None:
        await ws.send_json({"type": "error", "message": "Room not found. Check the code and try again."})
        await ws.close()
        return
    if len(room.players) >= MAX_PLAYERS:
        await ws.send_json({"type": "error", "message": "That room is full."})
        await ws.close()
        return

    # First message must be the join message with the player's name
    try:
        join = await receive_message(ws)
    except WebSocketDisconnect:
        return
    name = str(join.get("name", "")).strip()[:20] or "Player"

    player = Player(name, ws)
    room.players[player.id] = player
    if room.host_id is None:
        room.host_id = player.id

    try:
        await ws.send_json({"type": "welcome", "playerId": player.id})
        if room.status in ("playing", "finished"):
            await ws.send_json(room.questions_message())
        await room.broadcast(room.state_message())

        while True:
            await handle_message(room, player, await receive_message(ws))
    except WebSocketDisconnect:
        pass
    finally:
        room.players.pop(player.id, None)
        if not room.players:
            rooms.pop(room.code, None)
        else:
            if room.host_id == player.id:
                room.host_id = next(iter(room.players))  # pass host to the next player
            if room.status == "playing" and room.everyone_finished():
                room.status = "finished"
            await room.broadcast(room.state_message())
