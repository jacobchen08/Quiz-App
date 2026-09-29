import time

import pytest
from fastapi.testclient import TestClient

import apicall
import multiplayer
from conftest import raw_question
from multiplayer import Player, Room, expire_seat, speed_bonus

QUESTIONS = [
    raw_question("First?", "A"),
    raw_question("Second?", "True", ("False",), qtype="boolean"),
    raw_question("Third?", "C", ("A", "B", "D")),
]


@pytest.fixture
def client(monkeypatch):
    multiplayer.rooms.clear()
    monkeypatch.setattr(multiplayer, "fetch_questions", lambda *args, **kwargs: QUESTIONS)
    with TestClient(apicall.app) as c:
        yield c
    multiplayer.rooms.clear()


def receive_until(ws, kind):
    """Read messages until one of the given type arrives, and return it."""
    for _ in range(50):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"no {kind} message arrived")


def new_room(client):
    return client.post("/api/rooms").json()["code"]


def join(ws, name, token=None):
    ws.send_json({"type": "join", "name": name, "token": token})
    return receive_until(ws, "welcome")


# ---------- scoring rules ----------

def test_speed_bonus_is_full_when_quick_and_gone_when_slow():
    assert speed_bonus(0) == 50
    assert speed_bonus(5) == 50
    assert speed_bonus(12.5) == 25
    assert speed_bonus(20) == 0
    assert speed_bonus(90) == 0


def test_streaks_and_points_follow_answer_order():
    player = Player("Ann", ws=None)
    start = player.last_answer_at
    assert player.record(0, "A", True, now=start + 2) == 150  # quick: full bonus
    assert player.record(1, "B", True, now=start + 32) == 100  # slow: no bonus
    assert (player.streak, player.best_streak) == (2, 2)
    assert player.record(2, "X", False, now=start + 33) == 0
    assert (player.streak, player.best_streak, player.correct, player.score) == (0, 2, 2, 250)


# ---------- the room over a WebSocket ----------

def test_unknown_room_is_refused_with_a_code(client):
    with client.websocket_connect("/api/ws/NOPE1") as ws:
        message = ws.receive_json()
    assert message["type"] == "error"
    assert message["code"] == "room_not_found"


def test_first_player_hosts_and_gets_a_reconnect_token(client):
    code = new_room(client)
    with client.websocket_connect(f"/api/ws/{code}") as ws:
        welcome = join(ws, "Ann")
        state = receive_until(ws, "state")
    assert welcome["token"]
    assert state["hostId"] == welcome["playerId"]
    assert state["players"][0]["name"] == "Ann"


def test_answers_are_checked_on_the_server_and_never_sent_early(client):
    code = new_room(client)
    with client.websocket_connect(f"/api/ws/{code}") as ws:
        join(ws, "Ann")
        ws.send_json({"type": "start", "settings": {"amount": 3}})
        questions = receive_until(ws, "questions")["questions"]
        assert all("correct" not in q for q in questions)

        ws.send_json({"type": "answer", "index": 0, "answer": "A"})
        right = receive_until(ws, "answer_result")
        ws.send_json({"type": "answer", "index": 1, "answer": "False"})
        wrong = receive_until(ws, "answer_result")
        # a second go at the same question is ignored
        ws.send_json({"type": "answer", "index": 1, "answer": "True"})
        ws.send_json({"type": "answer", "index": 2, "answer": "C"})
        last = receive_until(ws, "answer_result")
        state = receive_until(ws, "state")

    assert right["correct"] and right["points"] >= 100 and right["streak"] == 1
    assert not wrong["correct"] and wrong["points"] == 0 and wrong["correctAnswer"] == "True"
    assert last["index"] == 2 and last["streak"] == 1
    me = state["players"][0]
    assert me["correct"] == 2 and me["bestStreak"] == 1
    assert state["status"] == "finished"


def test_reconnecting_with_the_token_restores_the_seat(client):
    code = new_room(client)
    with client.websocket_connect(f"/api/ws/{code}") as ws:
        first = join(ws, "Ann")
        ws.send_json({"type": "start", "settings": {}})
        receive_until(ws, "questions")
        ws.send_json({"type": "answer", "index": 0, "answer": "A"})
        receive_until(ws, "answer_result")
    # the socket dropped without "leave": the seat is held, not given away
    room = multiplayer.rooms[code]
    held = room.players[first["playerId"]]
    assert not held.connected

    with client.websocket_connect(f"/api/ws/{code}") as ws:
        again = join(ws, "Ann", token=first["token"])
        receive_until(ws, "questions")
        answers = receive_until(ws, "answers")
        state = receive_until(ws, "state")

    assert again["playerId"] == first["playerId"]
    assert answers["results"] == [
        {"index": 0, "answer": "A", "correct": True, "correctAnswer": "A", "points": held.answers[0]["points"]}
    ]
    assert state["hostId"] == first["playerId"]
    assert len(state["players"]) == 1


def test_a_wrong_token_joins_as_someone_new(client):
    code = new_room(client)
    with client.websocket_connect(f"/api/ws/{code}") as ws:
        first = join(ws, "Ann")
        with client.websocket_connect(f"/api/ws/{code}") as other:
            second = join(other, "Bob", token="made-up-token")
    assert second["playerId"] != first["playerId"]


def test_leaving_frees_the_seat_and_passes_the_host_on(client):
    code = new_room(client)
    with client.websocket_connect(f"/api/ws/{code}") as host:
        join(host, "Ann")
        with client.websocket_connect(f"/api/ws/{code}") as guest:
            guest_id = join(guest, "Bob")["playerId"]
            host.send_json({"type": "leave"})
            state = receive_until(guest, "state")
            while len(state["players"]) != 1:
                state = receive_until(guest, "state")
    assert state["hostId"] == guest_id
    assert [p["name"] for p in state["players"]] == ["Bob"]


def test_a_held_seat_expires_after_the_grace_period():
    multiplayer.rooms.clear()
    room = Room("TEST1")
    multiplayer.rooms[room.code] = room
    player = Player("Ann", ws=None)
    room.players[player.id] = player
    player.connected = False
    player.left_at = time.time()

    assert not expire_seat(room, player)  # still inside the grace period
    later = player.left_at + multiplayer.RECONNECT_GRACE + 1
    assert expire_seat(room, player, now=later)
    assert "TEST1" not in multiplayer.rooms  # the last seat going closes the room
