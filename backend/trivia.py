import html
import os
import random
import threading
import time

import requests

# Settings are passed in with each request (instead of stored in global variables)
# so that different players on the same server don't overwrite each other's choices.

VALID_DIFFICULTIES = {"easy", "medium", "hard"}
VALID_TYPES = {"multiple", "boolean"}


class TriviaError(Exception):
    pass


# Open Trivia DB allows one request per IP every 5 seconds. When two quizzes start close
# together, waiting it out once is friendlier than failing.
RATE_LIMIT_WAIT = 5.5
RATE_LIMIT_RETRIES = 1

TOKEN_URL = "https://opentdb.com/api_token.php"
TOKEN_RETRY_AFTER = 60  # seconds to wait before asking again if getting a token failed


class SessionToken:
    """Open Trivia DB's session token: while it's in use, no question comes back twice.

    One token is shared by the whole server, so players see fresh questions across rounds
    rather than the same popular ones again. When a token has handed out every question for
    some settings (response code 4) it's reset; when it has expired after 6 idle hours
    (code 3) a new one is requested. If the token service is down, quizzes still work,
    just without the no-repeats guarantee.
    """

    def __init__(self):
        self.value = None
        self.failed_at = None
        self.lock = threading.Lock()

    def get(self):
        with self.lock:
            if self.value is None and (self.failed_at is None or time.time() - self.failed_at > TOKEN_RETRY_AFTER):
                self.value = self._request()
                self.failed_at = None if self.value else time.time()
            return self.value

    def forget(self):
        with self.lock:
            self.value = None
            self.failed_at = None

    def reset(self):
        with self.lock:
            token = self.value
        if not token:
            return
        try:
            requests.get(TOKEN_URL, params={"command": "reset", "token": token}, timeout=10)
        except requests.RequestException:
            self.forget()  # can't reset it, so start over with a new one

    @staticmethod
    def _request():
        try:
            data = requests.get(TOKEN_URL, params={"command": "request"}, timeout=10).json()
        except (requests.RequestException, ValueError):
            return None
        return data.get("token") if data.get("response_code") == 0 else None


session_token = SessionToken()


def fetch_questions(
    amount=10, category="all", difficulty="all", question_type="all", retries=RATE_LIMIT_RETRIES, token_retries=1
):
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        amount = 10
    #restrict number of questions from being too many, max should be 50
    amount = max(1, min(amount, 50))

    # End-to-end tests run without the internet and need answers they can predict
    if os.environ.get("QUIZZR_OFFLINE_TRIVIA") == "1":
        return offline_questions(amount)

    url = f"https://opentdb.com/api.php?amount={amount}"

    #there's only a certain valid list of categories (9-32)
    if str(category).isdigit() and 9 <= int(category) <= 32:
        url += f"&category={category}"
    if difficulty in VALID_DIFFICULTIES:
        url += f"&difficulty={difficulty}"
    if question_type in VALID_TYPES:
        url += f"&type={question_type}"
    token = session_token.get()
    if token:
        url += f"&token={token}"

    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 429:
            # Rate limited: the body says so too ({"response_code": 5}), handled below
            data = {"response_code": 5}
        else:
            response.raise_for_status()
            data = response.json()
    except (requests.RequestException, ValueError) as e:
        raise TriviaError("Could not reach the trivia service. Try again.") from e

    # Open Trivia DB response codes: 1 = not enough questions, 3 = token expired,
    # 4 = token has used up every question for these settings, 5 = rate limited
    code = data.get("response_code", 0)
    if code in (3, 4) and token and token_retries > 0:
        if code == 3:
            session_token.forget()
        else:
            session_token.reset()
        return fetch_questions(amount, category, difficulty, question_type, retries, token_retries - 1)
    if code == 4:
        raise TriviaError("You've seen every question for those settings. Try another category or difficulty.")
    if code == 1:
        raise TriviaError("Not enough questions for those settings. Try fewer questions or another category.")
    if code == 5:
        if retries > 0:
            time.sleep(RATE_LIMIT_WAIT)
            return fetch_questions(amount, category, difficulty, question_type, retries - 1, token_retries)
        raise TriviaError("The trivia service is busy. Wait a few seconds and try again.")
    if code != 0:
        raise TriviaError("Failed to fetch questions")

    return data.get("results", [])


def prepare_question(raw):
    """Decode an Open Trivia DB question and fix its answer order.

    Shuffling once on the server means every player sees the options in the same order.
    The result keeps the correct answer under "correct"; never send that key to a browser
    before the player has answered.
    """
    correct = html.unescape(raw["correct_answer"])
    if raw["type"] == "multiple":
        options = [correct] + [html.unescape(a) for a in raw["incorrect_answers"]]
        random.shuffle(options)
    else:
        options = ["True", "False"]
    return {
        "question": html.unescape(raw["question"]),
        "category": html.unescape(raw["category"]),
        "difficulty": raw.get("difficulty", ""),
        "type": raw["type"],
        "options": options,
        "correct": correct,
    }


def public_question(question):
    """A prepared question without its correct answer, safe to send before answering."""
    return {k: question[k] for k in ("question", "category", "difficulty", "type", "options")}


def offline_questions(amount):
    """Predictable questions for end-to-end tests (QUIZZR_OFFLINE_TRIVIA=1): the answer to
    "Test question N" is always "Right N", and it's always one of four options."""
    return [
        {
            "type": "multiple",
            "difficulty": ("easy", "medium", "hard")[i % 3],
            "category": "General Knowledge",
            "question": f"Test question {i + 1}",
            "correct_answer": f"Right {i + 1}",
            "incorrect_answers": [f"Wrong {i + 1}a", f"Wrong {i + 1}b", f"Wrong {i + 1}c"],
        }
        for i in range(amount)
    ]
