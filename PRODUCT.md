# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primarily a portfolio and learning project. The main audience is recruiters, reviewers, and peers who open the deployed link to try it, usually for a few minutes and often alone, sometimes pulling in a friend to test multiplayer. The same person may be judging both how it feels to play and how well it is built. Everyday trivia players are a secondary audience, not the design target.

## Product Purpose
A trivia quiz in the browser. Players choose how many questions (1–50), a category, a difficulty, and a question type, then play either solo or in a live multiplayer room. Success means a first-time visitor starts playing within seconds, finishes a round without confusion, and comes away seeing a polished, well-engineered product.

## Positioning
Zero friction: no accounts and no install. In solo mode you pick settings and play. In multiplayer, one person creates a room and shares a 5-letter code or an invite link (`/?room=CODE`), and everyone is playing right away. Positioning beyond that is still undecided.

## Operating Context
- Two modes as tabs, Solo and Multiplayer. Both stay mounted, so switching tabs doesn't lose progress.
- Multiplayer flow: enter a name, then create or join a room. The room creator is the host and picks the settings. Everyone gets the same questions and answers at their own pace, and a live leaderboard shows scores and progress. The final results name the winner or winners, and the host can start another round.
- Questions come from the Open Trivia Database (via `backend/trivia.py`), so the question text, categories, and difficulty levels are external data.

## Capabilities and Constraints
- Stack: React 19 + Vite frontend (`my-react-app/`) and a FastAPI backend (`backend/`) with WebSockets for rooms. It deploys as one Docker service on Render's free plan (`render.yaml`).
- Must stay free to run and account-free. Rooms live in memory and are lost when the server restarts. Rooms hold at most 20 players, and names are capped at 20 characters.
- The server checks multiplayer answers and never sends correct answers to the browser before a player answers. This is an existing behavior, not a headline claim.
- Room codes use a 5-character alphabet that leaves out 0/O and 1/I.
- Three modes: Solo, Daily (the same 10 questions for everyone each UTC day, one go per browser, leaderboard ranked by correct answers then time), and Multiplayer.
- The daily challenge is the only persisted data: SQLite via `backend/daily.py` (path set by `QUIZZR_DB`). On Render's free plan the disk is temporary, so daily results reset whenever the server restarts. `database/data.sql` is an older, unused sketch.
- Multiplayer seats are held for 90 seconds after a dropped connection, and players rejoin with a per-tab token. Scoring is 100 points per correct answer plus up to 50 for speed.
- Timed multiplayer (10, 20 or 30 seconds per question, chosen by the host) runs in lockstep on the server's clock: one question open for everyone, late answers refused, the answer revealed to all when it closes.
- Every mode ends with a results screen and a copyable share text.
- Requests slower than 2.5 seconds show a "still working / waking the server up" notice, and requests give up after 90 seconds. A cold first page load can't show it, because the same server delivers the page; only hosting the frontend separately would fix that.
- Tests: pytest (`backend/tests`) and Vitest (`my-react-app/src/**/*.test.*`), run by GitHub Actions (`.github/workflows/ci.yml`).
- Name: "Quizzr" is now shown in the app header, but it's still unconfirmed as a brand. Positioning beyond zero friction is undecided.

## Brand Commitments
None yet. "Quiz App" is a placeholder name, so don't treat it as a brand or build identity around it.

## Evidence on Hand
No users, testimonials, usage data, or press. Future work must not invent player counts, reviews, or ratings. The only real content is the live Open Trivia DB questions and the app itself.

## Product Principles
1. **Playing within seconds.** Every added step before the first question needs a reason.
2. **Craft is the pitch.** The audience is judging the work, so edge cases, empty states, errors, and disconnects count as much as the happy path.
3. **Honest about what it is.** It's a free, account-free trivia app. Don't add claims, social proof, or features it doesn't have.
4. **Solo and multiplayer are one product.** Both modes share settings and the question card, so they should behave and read as one system.

## Accessibility & Inclusion
Target WCAG 2.2 AA. The whole game must be playable by keyboard. Correct and wrong answer states can't depend on color alone. Live changes (answer results, leaderboard updates, room status) must reach screen-reader users.
