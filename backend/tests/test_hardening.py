import json

from fastapi.testclient import TestClient

import main
import multiplayer
from ratelimit import RateLimiter
from trivia import fetch_questions


def test_rate_limiter_allows_a_burst_then_refuses_until_the_window_passes():
    limiter = RateLimiter(limit=3, window=10)
    assert [limiter.allow("ip", now=t) for t in (0, 1, 2, 3)] == [True, True, True, False]
    assert limiter.allow("someone-else", now=3)  # limits are per visitor
    assert limiter.allow("ip", now=10.5)  # the first hit has aged out


def test_creating_rooms_too_fast_is_refused():
    multiplayer.rooms.clear()
    with TestClient(main.app) as client:
        codes = [client.post("/api/rooms").status_code for _ in range(12)]
    assert codes[:10] == [200] * 10
    assert codes[10:] == [429, 429]
    multiplayer.rooms.clear()


def test_limits_follow_the_forwarded_address_behind_a_proxy():
    multiplayer.rooms.clear()
    with TestClient(main.app) as client:
        for _ in range(10):
            client.post("/api/rooms", headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1"})
        blocked = client.post("/api/rooms", headers={"x-forwarded-for": "203.0.113.7"})
        other = client.post("/api/rooms", headers={"x-forwarded-for": "198.51.100.2"})
    assert blocked.status_code == 429
    assert other.status_code == 200
    multiplayer.rooms.clear()


def test_oversized_socket_messages_are_ignored():
    multiplayer.rooms.clear()
    with TestClient(main.app) as client:
        code = client.post("/api/rooms").json()["code"]
        with client.websocket_connect(f"/api/ws/{code}") as ws:
            # a join padded past the size cap is ignored, so we're treated as a nameless player
            ws.send_text(json.dumps({"type": "join", "name": "Ann", "padding": "x" * 5000}))
            welcome = ws.receive_json()
            state = ws.receive_json()
    assert welcome["type"] == "welcome"
    assert state["players"][0]["name"] == "Player"
    multiplayer.rooms.clear()


def test_offline_trivia_gives_predictable_questions(monkeypatch):
    monkeypatch.setenv("QUIZZR_OFFLINE_TRIVIA", "1")
    questions = fetch_questions(3)
    assert [q["correct_answer"] for q in questions] == ["Right 1", "Right 2", "Right 3"]
