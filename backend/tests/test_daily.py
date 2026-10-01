import os

import pytest
from fastapi.testclient import TestClient

import apicall
import daily
import database
from conftest import raw_question

# Ten true/false questions: even-numbered ones are "True", odd ones "False"
QUESTIONS = [
    raw_question(f"Statement {i}", "True" if i % 2 == 0 else "False", ("False",) if i % 2 == 0 else ("True",), qtype="boolean")
    for i in range(10)
]
RIGHT = ["True" if i % 2 == 0 else "False" for i in range(10)]
WRONG = ["False" if i % 2 == 0 else "True" for i in range(10)]


@pytest.fixture
def client(tmp_path, monkeypatch):
    fetches = []

    def fake_fetch(amount=10, *args, **kwargs):
        fetches.append(amount)
        return QUESTIONS

    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "daily.db"))
    monkeypatch.setattr(database, "DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))
    monkeypatch.setattr(daily, "fetch_questions", fake_fetch)
    monkeypatch.setattr(daily, "today", lambda: "2026-01-01")
    if database.uses_postgres():
        # One Postgres database serves every test (CI sets TEST_DATABASE_URL), so start each one empty
        with database.connect(daily.SCHEMA) as conn:
            conn.execute("TRUNCATE daily_sets, daily_players, daily_answers")
    with TestClient(apicall.app) as c:
        c.fetches = fetches
        yield c


def start(client, token, name="Ann"):
    response = client.post("/api/daily/start", json={"token": token, "name": name})
    assert response.status_code == 200
    return response.json()


def answer(client, token, index, value):
    return client.post("/api/daily/answer", json={"token": token, "index": index, "answer": value})


def play(client, token, answers):
    for i, value in enumerate(answers):
        assert answer(client, token, i, value).status_code == 200


def test_questions_stay_hidden_until_you_start(client):
    before = client.get("/api/daily", headers={"X-Quizzr-Token": "token-ann-1"}).json()
    assert before["questions"] is None and before["player"] is None and before["total"] == 10

    started = start(client, "token-ann-1")
    assert len(started["questions"]) == 10
    assert all("correct" not in q for q in started["questions"])


def test_the_token_is_read_from_the_header_and_never_the_url(client):
    start(client, "token-ann-1")
    from_header = client.get("/api/daily", headers={"X-Quizzr-Token": "token-ann-1"}).json()
    from_url = client.get("/api/daily", params={"token": "token-ann-1"}).json()
    assert from_header["player"]["name"] == "Ann"
    assert from_url["player"] is None  # a token in the URL would end up in access logs


def test_everyone_gets_the_same_questions_fetched_once(client):
    a = start(client, "token-ann-1", "Ann")["questions"]
    b = start(client, "token-bob-1", "Bob")["questions"]
    assert a == b
    assert client.fetches == [10]


def test_answers_are_checked_once_each(client):
    start(client, "token-ann-1")
    right = answer(client, "token-ann-1", 0, "True").json()
    assert right["correct"] and right["correctAnswer"] == "True"
    assert right["player"]["correct"] == 1 and not right["player"]["finished"]

    again = answer(client, "token-ann-1", 0, "False")
    assert again.status_code == 409

    wrong = answer(client, "token-ann-1", 1, "True").json()
    assert not wrong["correct"] and wrong["correctAnswer"] == "False"


def test_you_have_to_start_first_and_questions_must_exist(client):
    assert answer(client, "token-nobody", 0, "True").status_code == 404
    start(client, "token-ann-1")
    assert answer(client, "token-ann-1", 10, "True").status_code == 400


def test_starting_again_resumes_instead_of_resetting(client):
    start(client, "token-ann-1")
    answer(client, "token-ann-1", 0, "True")
    resumed = start(client, "token-ann-1", "A new name")
    assert resumed["player"]["name"] == "Ann"
    assert [a["index"] for a in resumed["player"]["answers"]] == [0]


def test_leaderboard_ranks_most_correct_then_fastest(client):
    for token, name, answers in [
        ("token-slow-perfect", "Slow", RIGHT),
        ("token-quick-perfect", "Quick", RIGHT),
        ("token-half", "Half", RIGHT[:5] + WRONG[5:]),
    ]:
        start(client, token, name)
        play(client, token, answers)

    # Make the times deterministic: Slow took 90s, Quick 30s, Half 10s
    with database.connect(daily.SCHEMA) as conn:
        for token, seconds in [("token-slow-perfect", 90), ("token-quick-perfect", 30), ("token-half", 10)]:
            conn.execute(
                "UPDATE daily_players SET started_at = finished_at - ? WHERE token = ?", (seconds, token)
            )

    board = client.get("/api/daily/leaderboard", headers={"X-Quizzr-Token": "token-half"}).json()
    assert [e["name"] for e in board["entries"]] == ["Quick", "Slow", "Half"]
    assert [e["correct"] for e in board["entries"]] == [10, 10, 5]
    assert [e["you"] for e in board["entries"]] == [False, False, True]

    view = client.get("/api/daily", headers={"X-Quizzr-Token": "token-quick-perfect"}).json()["player"]
    assert view["finished"] and view["rank"] == 1 and view["finishers"] == 3


def test_unfinished_players_are_not_on_the_leaderboard(client):
    start(client, "token-ann-1")
    answer(client, "token-ann-1", 0, "True")
    assert client.get("/api/daily/leaderboard").json()["entries"] == []
