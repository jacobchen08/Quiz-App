import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from trivia import TriviaError, fetch_questions, prepare_question, public_question

# Daily challenge: everyone gets the same questions each day (UTC), like Wordle.
#
# 1. GET  /api/daily?token=...        today's date and, if you've started, your questions and answers
# 2. POST /api/daily/start            {token, name} starts your clock and returns the questions
# 3. POST /api/daily/answer           {token, index, answer} checks one answer on the server
# 4. GET  /api/daily/leaderboard      today's finishers: most correct first, then fastest
#
# There are no accounts. The browser makes up a random token and keeps it, and one token
# gets one go per day. Correct answers only leave the server once that question is answered.
#
# Results are kept in SQLite. Set QUIZZR_DB to choose where the file lives; on hosts with a
# temporary disk (like Render's free plan) it resets whenever the server restarts.

router = APIRouter(prefix="/api/daily")

DB_PATH = os.environ.get("QUIZZR_DB", str(Path(__file__).resolve().parent / "quizzr.db"))
DAILY_QUESTIONS = 10
LEADERBOARD_SIZE = 20

_fetch_lock = threading.Lock()  # so two early visitors don't both fetch today's questions

SCHEMA = """
CREATE TABLE IF NOT EXISTS daily_sets (
    date        TEXT PRIMARY KEY,
    questions   TEXT NOT NULL,
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_players (
    date        TEXT NOT NULL,
    token       TEXT NOT NULL,
    name        TEXT NOT NULL,
    correct     INTEGER NOT NULL DEFAULT 0,
    started_at  REAL NOT NULL,
    finished_at REAL,
    PRIMARY KEY (date, token)
);
CREATE TABLE IF NOT EXISTS daily_answers (
    date        TEXT NOT NULL,
    token       TEXT NOT NULL,
    idx         INTEGER NOT NULL,
    answer      TEXT NOT NULL,
    correct     INTEGER NOT NULL,
    answered_at REAL NOT NULL,
    PRIMARY KEY (date, token, idx)
);
"""


def today():
    return datetime.now(timezone.utc).date().isoformat()


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def load_questions(conn, date):
    row = conn.execute("SELECT questions FROM daily_sets WHERE date = ?", (date,)).fetchone()
    return json.loads(row["questions"]) if row else None


def todays_questions(date):
    """Today's prepared questions, fetching and saving them the first time they're asked for."""
    with db() as conn:
        questions = load_questions(conn, date)
    if questions is not None:
        return questions

    with _fetch_lock:
        with db() as conn:
            questions = load_questions(conn, date)
            if questions is not None:
                return questions
        try:
            raw = fetch_questions(DAILY_QUESTIONS)
        except TriviaError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
        questions = [prepare_question(q) for q in raw]
        with db() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO daily_sets (date, questions, created_at) VALUES (?, ?, ?)",
                (date, json.dumps(questions), time.time()),
            )
            return load_questions(conn, date)


def finished_ranking(conn, date):
    """Everyone who finished today, best first: most correct, then fastest, then earliest."""
    return conn.execute(
        """
        SELECT token, name, correct, finished_at - started_at AS seconds
        FROM daily_players
        WHERE date = ? AND finished_at IS NOT NULL
        ORDER BY correct DESC, seconds ASC, finished_at ASC
        """,
        (date,),
    ).fetchall()


def player_view(conn, date, token, questions):
    row = conn.execute(
        "SELECT * FROM daily_players WHERE date = ? AND token = ?", (date, token)
    ).fetchone()
    if row is None:
        return None
    answers = conn.execute(
        "SELECT idx, answer, correct FROM daily_answers WHERE date = ? AND token = ? ORDER BY answered_at",
        (date, token),
    ).fetchall()
    view = {
        "name": row["name"],
        "correct": row["correct"],
        "finished": row["finished_at"] is not None,
        "seconds": None,
        "rank": None,
        "finishers": None,
        # in the order they were answered, which is what streaks count
        "answers": [
            {
                "index": a["idx"],
                "answer": a["answer"],
                "correct": bool(a["correct"]),
                "correctAnswer": questions[a["idx"]]["correct"],
            }
            for a in answers
        ],
    }
    if view["finished"]:
        ranking = finished_ranking(conn, date)
        view["seconds"] = round(row["finished_at"] - row["started_at"], 1)
        view["rank"] = next(i + 1 for i, r in enumerate(ranking) if r["token"] == token)
        view["finishers"] = len(ranking)
    return view


class StartBody(BaseModel):
    token: str = Field(min_length=8, max_length=64)
    name: str = Field(min_length=1, max_length=20)


class AnswerBody(BaseModel):
    token: str = Field(min_length=8, max_length=64)
    index: int
    answer: str = Field(max_length=500)


@router.get("")
def get_daily(token: str = ""):
    date = today()
    questions = todays_questions(date)
    with db() as conn:
        player = player_view(conn, date, token, questions) if token else None
    return {
        "date": date,
        "total": len(questions),
        # the questions only go out once your clock is running
        "questions": [public_question(q) for q in questions] if player else None,
        "player": player,
    }


@router.post("/start")
def start_daily(body: StartBody):
    date = today()
    questions = todays_questions(date)
    name = body.name.strip()[:20] or "Player"
    with db() as conn:
        # Starting twice just resumes: the clock keeps its original start time
        conn.execute(
            "INSERT OR IGNORE INTO daily_players (date, token, name, started_at) VALUES (?, ?, ?, ?)",
            (date, body.token, name, time.time()),
        )
        player = player_view(conn, date, body.token, questions)
    return {
        "date": date,
        "total": len(questions),
        "questions": [public_question(q) for q in questions],
        "player": player,
    }


@router.post("/answer")
def answer_daily(body: AnswerBody):
    date = today()
    questions = todays_questions(date)
    if not 0 <= body.index < len(questions):
        raise HTTPException(status_code=400, detail="There's no question with that number.")

    question = questions[body.index]
    correct = body.answer == question["correct"]
    now = time.time()
    with db() as conn:
        if conn.execute(
            "SELECT 1 FROM daily_players WHERE date = ? AND token = ?", (date, body.token)
        ).fetchone() is None:
            raise HTTPException(status_code=404, detail="Start today's challenge first.")
        try:
            conn.execute(
                "INSERT INTO daily_answers (date, token, idx, answer, correct, answered_at) VALUES (?, ?, ?, ?, ?, ?)",
                (date, body.token, body.index, body.answer, int(correct), now),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="You've already answered that question.")

        answered = conn.execute(
            "SELECT COUNT(*) FROM daily_answers WHERE date = ? AND token = ?", (date, body.token)
        ).fetchone()[0]
        conn.execute(
            """
            UPDATE daily_players
            SET correct = correct + ?,
                finished_at = CASE WHEN ? >= ? THEN ? ELSE finished_at END
            WHERE date = ? AND token = ?
            """,
            (int(correct), answered, len(questions), now, date, body.token),
        )
        player = player_view(conn, date, body.token, questions)

    return {
        "index": body.index,
        "answer": body.answer,
        "correct": correct,
        "correctAnswer": question["correct"],
        "player": player,
    }


@router.get("/leaderboard")
def daily_leaderboard(token: str = ""):
    date = today()
    with db() as conn:
        ranking = finished_ranking(conn, date)
    entries = [
        {
            "rank": i + 1,
            "name": r["name"],
            "correct": r["correct"],
            "seconds": round(r["seconds"], 1),
            "you": bool(token) and r["token"] == token,
        }
        for i, r in enumerate(ranking)
    ]
    shown = entries[:LEADERBOARD_SIZE]
    # If you finished outside the top rows, you still see your own line
    mine = next((e for e in entries if e["you"]), None)
    if mine and mine not in shown:
        shown.append(mine)
    return {"date": date, "finishers": len(entries), "entries": shown}
