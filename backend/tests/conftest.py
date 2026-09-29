import sys
from pathlib import Path

# The backend modules import each other by plain name (as uvicorn runs them from backend/),
# so put that folder on the path for the tests too.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def raw_question(question, correct, incorrect=("B", "C", "D"), qtype="multiple", category="General Knowledge"):
    """A question shaped like Open Trivia DB's API returns it."""
    return {
        "type": qtype,
        "difficulty": "easy",
        "category": category,
        "question": question,
        "correct_answer": correct,
        "incorrect_answers": list(incorrect),
    }
