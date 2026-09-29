import html
import random

import requests

# Settings are passed in with each request (instead of stored in global variables)
# so that different players on the same server don't overwrite each other's choices.

VALID_DIFFICULTIES = {"easy", "medium", "hard"}
VALID_TYPES = {"multiple", "boolean"}


class TriviaError(Exception):
    pass


def fetch_questions(amount=10, category="all", difficulty="all", question_type="all"):
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        amount = 10
    #restrict number of questions from being too many, max should be 50
    amount = max(1, min(amount, 50))

    url = f"https://opentdb.com/api.php?amount={amount}"

    #there's only a certain valid list of categories (9-32)
    if str(category).isdigit() and 9 <= int(category) <= 32:
        url += f"&category={category}"
    if difficulty in VALID_DIFFICULTIES:
        url += f"&difficulty={difficulty}"
    if question_type in VALID_TYPES:
        url += f"&type={question_type}"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as e:
        raise TriviaError("Could not reach the trivia service. Try again.") from e

    # Open Trivia DB response codes: 1 = not enough questions, 5 = rate limited
    code = data.get("response_code", 0)
    if code == 1:
        raise TriviaError("Not enough questions for those settings. Try fewer questions or another category.")
    if code == 5:
        raise TriviaError("Too many requests. Wait a few seconds and try again.")
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
