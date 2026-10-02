# Quizzr

[![CI](https://github.com/jacobchen08/Quiz-App/actions/workflows/ci.yml/badge.svg?branch=app-prototype-v2)](https://github.com/jacobchen08/Quiz-App/actions/workflows/ci.yml)

A trivia game styled like a train station departure board. You can play on your own, take a daily challenge where everyone gets the same ten questions, or start a room and play live with friends. Questions come from the [Open Trivia Database](https://opentdb.com/).

The frontend is React and Vite. The backend is FastAPI, with WebSockets for the multiplayer rooms.

<p align="center">
  <img src="docs/question.png" alt="A solo round on desktop: the quiz settings, a question answered wrong with the correct answer shown, and side boards with the round's progress" width="720">
</p>

<p align="center">
  <img src="docs/results.png" alt="The results of a solo round: 2 out of 3, the missed question with the right answer, and a shareable result" width="480">
  &nbsp;
  <img src="docs/phone.png" alt="A question on a phone" width="200">
</p>

## Features

- **Solo:** 1 to 50 questions, with optional filters for category, difficulty and question type, and an optional timer. At the end you see the questions you missed and get a result you can share.
- **Daily:** the same ten questions for everyone, once a day (the day changes at midnight UTC). The leaderboard sorts by correct answers, then time.
- **Multiplayer:** create a room and send friends the code or invite link. A right answer is worth 100 points, plus up to 50 more for speed. With a timer on, everyone answers each question at the same time.

It also handles reconnecting (reload mid-game and you're back in your seat), works offline for solo play once you've visited, and can be played from the keyboard: `A` to `D` to choose, `Enter` to submit, arrow keys to move between questions.

## How it works

```mermaid
flowchart LR
    subgraph Browser["Browser (React + Vite)"]
        UI[Solo / Daily / Multiplayer]
    end
    subgraph API["FastAPI server"]
        Q["/api/questions"]
        D["/api/daily/*"]
        R["/api/rooms + /api/ws/{code}<br/>(WebSocket rooms, in memory)"]
    end
    DB[(Postgres<br/>or SQLite in dev)]
    OTDB[Open Trivia DB]

    UI -- HTTPS --> Q
    UI -- HTTPS --> D
    UI <-- WebSocket --> R
    Q --> OTDB
    D --> OTDB
    R --> OTDB
    D --> DB
```

Solo play only needs the server to fetch questions. Answers are checked in the browser, since you're only playing against yourself.

In the daily challenge and in multiplayer, the correct answers stay on the server. Each one is only sent to the browser after you answer (or, in a timed game, when time runs out), so nobody can find them in dev tools. Daily results are stored in Postgres in production and in a SQLite file during development. Multiplayer rooms only live in the server's memory, so a restart ends any game in progress.

A few design choices worth explaining:

- When a player's connection drops without them leaving, the server holds their seat for 90 seconds. The browser keeps a token for that tab and uses it to rejoin. Without this, a phone switching apps for a moment would knock someone out of the game.
- Timed games run on the server's clock. Every update includes the server's current time, so each browser can count down to the same deadline, and answers that arrive too late are refused.
- There are no accounts. The daily challenge identifies you with a random token saved in your browser. Clearing your storage would give you a second attempt, which seemed like a fair trade for not making anyone sign up.
- A daily run started just before midnight can still be finished after it. The browser sends the date the run started with each answer, and the server accepts it if that's today or yesterday.

## Running it locally

You'll need Python 3.12 or newer and Node 22 or newer. Start the API first:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --no-access-log
```

Then, in a second terminal, the app:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` requests to the API on port 8000.

## Tests

```bash
# backend
pip install -r backend/requirements-dev.txt
python -m pytest backend

# frontend unit tests and end-to-end tests (run inside frontend/)
npm test
npx playwright install chromium firefox webkit   # once
npm run test:e2e
```

The backend tests cover fetching questions, multiplayer rooms (scoring, reconnecting, timed games), the daily challenge and rate limiting. The end-to-end tests play each mode in Chromium, Firefox and WebKit (the engine behind Safari), including a two-player game where one player reloads halfway through and a round on a phone-sized screen, and run accessibility checks in light and dark mode. They start their own copy of the API with fixed test questions, so they don't need the internet. Locally they skip Firefox unless you set `E2E_BROWSERS=chromium,firefox,webkit`, because some Windows security settings block Playwright's copy of it.

GitHub Actions runs everything on each push, and runs the daily challenge tests a second time against Postgres.

## Deploying

[`render.yaml`](render.yaml) sets up two services on [Render](https://render.com): the app as a static site and the API as a Docker container. Keeping them separate means the page loads straight away even when the free API server is asleep, and the app shows a message while it wakes up.

The only setting to fill in by hand is `DATABASE_URL` on the API, which should point at a Postgres database (a free [Neon](https://neon.tech) one works). Without it the daily leaderboard falls back to SQLite and is wiped every time Render restarts the server.

The [`Dockerfile`](Dockerfile) can also run everything as a single service, with the API serving the built app.

## Project structure

```
backend/
  main.py           creates the FastAPI app and registers the routes
  trivia.py         fetches questions from Open Trivia DB
  multiplayer.py    multiplayer rooms over WebSockets
  daily.py          the daily challenge and its leaderboard
  database.py       Postgres or SQLite connections
  ratelimit.py      per-IP rate limits
  logs.py           JSON logging
  tests/

frontend/src/
  main.jsx          entry point
  App.jsx           the page layout and mode tabs
  modes/            Solo, Daily and Multiplayer, one folder each
  components/       pieces shared by the modes, like the question card and results
  hooks/            reusable React hooks
  lib/              logic with no React in it: API calls, scoring, browser storage
  styles/           one stylesheet per part of the page; tokens.css has the colours and fonts
frontend/e2e/       end-to-end tests
docs/               screenshots for this README
```

[`DESIGN.md`](DESIGN.md) describes the visual design and [`PRODUCT.md`](PRODUCT.md) covers who the app is for.

## Credits

Questions come from the [Open Trivia Database](https://opentdb.com/) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The typeface is [Sofia Sans](https://github.com/lettersoup/Sofia-Sans), under the SIL Open Font License.
