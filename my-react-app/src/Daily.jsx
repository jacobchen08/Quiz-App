import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { daily } from './api';
import QuestionCard from './components/QuestionCard';
import ResultsBoard from './components/ResultsBoard';
import FlapText from './components/FlapText';
import Icon from './components/Icon';
import { formatSeconds, ordinal, shareText, streaks } from './results';

// Daily challenge: the same 10 questions for everyone today, one go each.
// The server (backend/daily.py) checks every answer and keeps the leaderboard.
// A random token in localStorage stands in for an account, so a returning visitor
// picks up where they left off.

const TOKEN_KEY = 'quizzr-daily-token';
const NAME_KEY = 'quizzr-name';

function makeToken() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function stored(key, fallback) {
  try {
    let value = localStorage.getItem(key);
    if (value === null && fallback) {
      value = fallback();
      localStorage.setItem(key, value);
    }
    return value ?? '';
  } catch {
    return fallback ? fallback() : '';
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private browsing; the name just won't be prefilled next time
  }
}

// "Tue 29 Sep" in the visitor's own language
function dayLabel(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

// When the next challenge appears, in the visitor's local time
function nextChallengeLabel(date) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function DailyLeaderboard({ board, total }) {
  if (!board) return null;
  return (
    <section className="board" aria-labelledby="daily-board-title">
      <div className="board-head">
        <h2 className="board-title" id="daily-board-title">Today's leaderboard</h2>
        <span className="board-head-cols" aria-hidden="true">
          <span>Correct</span>
          <span>Time</span>
        </span>
      </div>
      {board.entries.length === 0 ? (
        <p className="log-empty">Nobody has finished today's challenge yet. You could be first.</p>
      ) : (
        <ol className="leaderboard daily-board">
          {board.entries.map((entry) => (
            <li key={`${entry.rank}-${entry.name}`} className={entry.you ? 'me' : ''}>
              <span className="rank">{entry.rank}</span>
              <span className="player-name">
                {entry.name}
                {entry.you && <span className="badge badge-you">you</span>}
              </span>
              <span className="player-progress">{entry.correct}/{total}</span>
              <span className="player-time">{formatSeconds(entry.seconds)}</span>
            </li>
          ))}
        </ol>
      )}
      {board.finishers > board.entries.length && (
        <p className="board-foot">{board.finishers} players have finished today.</p>
      )}
    </section>
  );
}

function Daily({ onProgress }) {
  const [token] = useState(() => stored(TOKEN_KEY, makeToken));
  const [name, setName] = useState(() => stored(NAME_KEY));
  const [status, setStatus] = useState('loading'); // loading | failed | intro | playing
  const [error, setError] = useState('');
  const [date, setDate] = useState(null);
  const [total, setTotal] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [player, setPlayer] = useState(null);
  const [results, setResults] = useState({}); // question index -> { answer, correct, correctAnswer }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [board, setBoard] = useState(null);
  const [starting, setStarting] = useState(false);
  const [justStarted, setJustStarted] = useState(0); // bumps on Start, to bring question 1 into view
  const stageRef = useRef(null);

  useEffect(() => {
    if (justStarted === 0) return;
    const board = stageRef.current?.querySelector('.question-board');
    if (!board) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    board.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    board.focus({ preventScroll: true });
  }, [justStarted]);

  const refreshBoard = useCallback(() => {
    daily.leaderboard(token).then(setBoard).catch(() => {});
  }, [token]);

  // Take in the server's view of this player: their answers, and where to carry on
  const applyPlayer = useCallback((view, list) => {
    setPlayer(view);
    setResults(Object.fromEntries(view.answers.map((a) => [a.index, a])));
    const answered = new Set(view.answers.map((a) => a.index));
    const next = list.findIndex((_, i) => !answered.has(i));
    setCurrentIndex(next === -1 ? 0 : next);
    setShowResults(view.finished);
  }, []);

  const load = useCallback(() => {
    daily
      .load(token)
      .then((data) => {
        setDate(data.date);
        setTotal(data.total);
        if (data.player) {
          setQuestions(data.questions);
          applyPlayer(data.player, data.questions);
          setStatus('playing');
        } else {
          setStatus('intro');
        }
      })
      .catch((e) => {
        setError(e.message);
        setStatus('failed');
      });
    refreshBoard();
  }, [token, refreshBoard, applyPlayer]);

  useEffect(load, [load]);

  async function start() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter your name first. It goes on the leaderboard.');
    setStarting(true);
    setError('');
    try {
      const data = await daily.start(token, trimmed);
      remember(NAME_KEY, trimmed);
      setDate(data.date);
      setQuestions(data.questions);
      applyPlayer(data.player, data.questions);
      setStatus('playing');
      setJustStarted((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  async function answer(option) {
    const index = currentIndex;
    setResults((prev) => ({ ...prev, [index]: { answer: option } })); // shows as "checking"
    setError('');
    try {
      const data = await daily.answer(token, index, option);
      setResults((prev) => ({ ...prev, [index]: data }));
      setPlayer(data.player);
      if (data.player.finished) refreshBoard();
    } catch (e) {
      setResults((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      setError(e.message);
    }
  }

  // Marks and streaks, with answers in the order they were given
  const marks = useMemo(
    () =>
      questions.map((_, i) => {
        const r = results[i];
        if (!r) return undefined;
        if (r.correctAnswer === undefined) return 'pending';
        return r.correct ? 'correct' : 'wrong';
      }),
    [questions, results]
  );
  const ordered = useMemo(() => player?.answers ?? [], [player]);
  const streak = useMemo(() => streaks(ordered.map((a) => a.correct)), [ordered]);
  const correct = marks.filter((m) => m === 'correct').length;
  const answered = marks.filter((m) => m === 'correct' || m === 'wrong').length;

  const items = useMemo(
    () => questions.map((q, i) => ({ question: q.question, category: q.category, mark: marks[i] })),
    [questions, marks]
  );
  useEffect(() => {
    onProgress?.({
      answered,
      correct,
      total: questions.length,
      streak: streak.current,
      index: currentIndex,
      items,
      jump: (i) => {
        setShowResults(false);
        setCurrentIndex(i);
      },
    });
  }, [answered, correct, questions.length, streak, currentIndex, items, onProgress]);

  const head = (
    <section className="board daily-head" aria-labelledby="daily-title">
      <div className="board-head">
        <h2 className="board-title" id="daily-title">Daily challenge</h2>
        {date && <span className="daily-date">{dayLabel(date)}</span>}
      </div>
      <div className="board-body">
        <p className="daily-lede">
          The same {total} questions for everyone today, and one go each. Every answer counts,
          and ties go to whoever finished faster.
        </p>
        {status === 'intro' && (
          <div className="daily-start">
            <div className="field name-field">
              <label htmlFor="daily-name">Your name for the leaderboard</label>
              <input
                id="daily-name"
                type="text"
                maxLength={20}
                placeholder="e.g. Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && start()}
              />
            </div>
            <button className="btn btn-primary" onClick={start} disabled={starting}>
              {starting ? 'Starting…' : "Start today's challenge"}
            </button>
          </div>
        )}
        {status === 'intro' && (
          <p className="muted-text daily-clock-note">The clock starts when you press start.</p>
        )}
        {status === 'playing' && player && !player.finished && (
          <p className="muted-text">Playing as {player.name}. The clock is running.</p>
        )}
        {status === 'loading' && <p className="muted-text" role="status">Loading today's challenge…</p>}
        {status === 'failed' && (
          <div className="daily-start">
            <button
              className="btn"
              onClick={() => {
                setStatus('loading');
                setError('');
                load();
              }}
            >
              <Icon name="replay" />
              Try again
            </button>
          </div>
        )}
        {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}
      </div>
    </section>
  );

  const current = questions[currentIndex];
  const finished = player?.finished;

  return (
    <>
      {head}

      {status === 'playing' && finished && showResults && (
        <ResultsBoard
          title="Today's results"
          correct={player.correct}
          total={questions.length}
          stats={[
            { label: 'Time', value: formatSeconds(player.seconds) },
            { label: 'Rank', value: `${ordinal(player.rank)} of ${player.finishers}` },
            { label: 'Best streak', value: streak.best },
          ]}
          missed={questions
            .map((q, i) => ({
              index: i,
              question: q.question,
              category: q.category,
              answer: results[i]?.answer,
              correctAnswer: results[i]?.correctAnswer,
            }))
            .filter((m) => marks[m.index] !== 'correct')}
          share={shareText({
            title: `Quizzr Daily · ${dayLabel(date)} · ${player.correct}/${questions.length}`,
            marks,
            lines: [`${formatSeconds(player.seconds)} · ${ordinal(player.rank)} of ${player.finishers}`],
            url: window.location.origin,
          })}
          note={`A new challenge appears at ${nextChallengeLabel(date)} your time.`}
          actions={
            <button className="btn" onClick={() => setShowResults(false)}>
              Review questions
            </button>
          }
        />
      )}

      {status === 'playing' && current && !(finished && showResults) && (
        <div ref={stageRef} className="stage">
        <QuestionCard
          index={currentIndex}
          total={questions.length}
          category={current.category}
          difficulty={current.difficulty}
          question={current.question}
          options={current.options}
          picked={results[currentIndex]?.answer}
          correctAnswer={results[currentIndex]?.correctAnswer}
          score={correct}
          streak={streak.current}
          note={
            marks[currentIndex] === 'correct' && streak.current >= 2 && ordered.at(-1)?.index === currentIndex
              ? `${streak.current} in a row.`
              : undefined
          }
          marks={marks}
          finishAction={finished ? { label: 'See results', onClick: () => setShowResults(true) } : undefined}
          onAnswer={answer}
          onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          onJump={setCurrentIndex}
        />
        </div>
      )}

      {status === 'intro' && (
        <section className="board board-idle">
          <div className="board-body">
            <FlapText text="DAILY" length={10} label="" size="lg" />
            <p>Today's questions stay hidden until you start.</p>
          </div>
        </section>
      )}

      <DailyLeaderboard board={board} total={total} />
    </>
  );
}

export default Daily;
