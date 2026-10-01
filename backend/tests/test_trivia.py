import pytest
import requests

import trivia
from conftest import raw_question
from trivia import TriviaError, fetch_questions, prepare_question, public_question


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


@pytest.fixture(autouse=True)
def no_session_token(monkeypatch, request):
    """Most tests are about the question URL itself, so run them without a session token."""
    trivia.session_token.forget()
    if "with_token" not in request.keywords:
        monkeypatch.setattr(trivia.session_token, "get", lambda: None)
    yield
    trivia.session_token.forget()


class FakeTriviaService:
    """Plays both Open Trivia DB endpoints: the token service and the question service."""

    def __init__(self, question_codes, token_works=True):
        self.question_codes = list(question_codes)  # response code for each question request
        self.token_works = token_works
        self.issued = 0
        self.calls = []

    def get(self, url, timeout, params=None):
        if url == trivia.TOKEN_URL:
            self.calls.append(("token", params["command"]))
            if not self.token_works:
                raise requests.ConnectionError("token service down")
            if params["command"] == "request":
                self.issued += 1
                return FakeResponse({"response_code": 0, "token": f"tok{self.issued}"})
            return FakeResponse({"response_code": 0, "token": params["token"]})  # reset
        self.calls.append(("questions", url))
        code = self.question_codes.pop(0)
        return FakeResponse({"response_code": code, "results": ["q"] if code == 0 else []})


@pytest.mark.with_token
def test_questions_are_asked_for_with_the_session_token(monkeypatch):
    service = FakeTriviaService([0, 0])
    monkeypatch.setattr(trivia.requests, "get", service.get)
    fetch_questions(5)
    fetch_questions(5)
    question_urls = [url for kind, url in service.calls if kind == "questions"]
    assert all(url.endswith("&token=tok1") for url in question_urls)
    assert service.issued == 1  # one token, reused


@pytest.mark.with_token
def test_a_used_up_token_is_reset_and_the_request_retried(monkeypatch):
    service = FakeTriviaService([4, 0])
    monkeypatch.setattr(trivia.requests, "get", service.get)
    assert fetch_questions(5) == ["q"]
    assert ("token", "reset") in service.calls


@pytest.mark.with_token
def test_an_expired_token_is_replaced(monkeypatch):
    service = FakeTriviaService([3, 0])
    monkeypatch.setattr(trivia.requests, "get", service.get)
    assert fetch_questions(5) == ["q"]
    question_urls = [url for kind, url in service.calls if kind == "questions"]
    assert question_urls[0].endswith("&token=tok1")
    assert question_urls[1].endswith("&token=tok2")


@pytest.mark.with_token
def test_quizzes_still_work_when_the_token_service_is_down(monkeypatch):
    service = FakeTriviaService([0], token_works=False)
    monkeypatch.setattr(trivia.requests, "get", service.get)
    assert fetch_questions(5) == ["q"]
    question_urls = [url for kind, url in service.calls if kind == "questions"]
    assert "token=" not in question_urls[0]


@pytest.fixture
def captured(monkeypatch):
    """Record the URL fetch_questions asks for, and answer with a chosen payload."""
    calls = {"payload": {"response_code": 0, "results": []}}

    def fake_get(url, timeout):
        calls["url"] = url
        return FakeResponse(calls["payload"])

    monkeypatch.setattr(trivia.requests, "get", fake_get)
    return calls


def test_builds_url_from_valid_settings(captured):
    fetch_questions(15, "23", "hard", "boolean")
    assert captured["url"] == "https://opentdb.com/api.php?amount=15&category=23&difficulty=hard&type=boolean"


def test_ignores_invalid_settings_and_clamps_amount(captured):
    fetch_questions(500, "999", "impossible", "essay")
    assert captured["url"] == "https://opentdb.com/api.php?amount=50"
    fetch_questions("not a number")
    assert captured["url"] == "https://opentdb.com/api.php?amount=10"
    fetch_questions(0)
    assert captured["url"] == "https://opentdb.com/api.php?amount=1"


@pytest.mark.parametrize(
    "code, message",
    [(1, "Not enough questions"), (5, "busy"), (3, "Failed to fetch")],
)
def test_api_error_codes_become_friendly_errors(captured, monkeypatch, code, message):
    monkeypatch.setattr(trivia.time, "sleep", lambda seconds: None)
    captured["payload"] = {"response_code": code, "results": []}
    with pytest.raises(TriviaError, match=message):
        fetch_questions()


def test_rate_limit_waits_and_retries_once(monkeypatch):
    # Open Trivia DB answers a rate-limited request with HTTP 429 and response_code 5
    responses = [
        FakeResponse({"response_code": 5, "result": []}, status_code=429),
        FakeResponse({"response_code": 0, "results": ["question"]}),
    ]
    waits = []
    monkeypatch.setattr(trivia.requests, "get", lambda url, timeout: responses.pop(0))
    monkeypatch.setattr(trivia.time, "sleep", waits.append)
    assert fetch_questions() == ["question"]
    assert waits == [trivia.RATE_LIMIT_WAIT]


def test_network_failure_becomes_friendly_error(monkeypatch):
    def broken_get(url, timeout):
        raise requests.ConnectionError("offline")

    monkeypatch.setattr(trivia.requests, "get", broken_get)
    with pytest.raises(TriviaError, match="Could not reach"):
        fetch_questions()


def test_prepare_question_decodes_and_keeps_every_option():
    q = prepare_question(raw_question("Who wrote &quot;Hamlet&quot;?", "Shakespeare &amp; co", ("Marlowe", "Jonson", "Kyd")))
    assert q["question"] == 'Who wrote "Hamlet"?'
    assert q["correct"] == "Shakespeare & co"
    assert sorted(q["options"]) == sorted(["Shakespeare & co", "Marlowe", "Jonson", "Kyd"])


def test_true_false_options_are_always_in_order():
    q = prepare_question(raw_question("Water is wet.", "True", ("False",), qtype="boolean"))
    assert q["options"] == ["True", "False"]


def test_public_question_hides_the_answer():
    q = public_question(prepare_question(raw_question("2 + 2?", "4")))
    assert "correct" not in q
    assert set(q) == {"question", "category", "difficulty", "type", "options"}
