import { useEffect, useMemo, useRef, useState } from 'react';
import { questionsUrl } from './api';
import Settings from './components/Settings';
import QuestionCard from './components/QuestionCard';
import ResultsBoard from './components/ResultsBoard';
import FlapText from './components/FlapText';
import Icon from './components/Icon';
import { shareText, streaks } from './results';

function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Decode one Open Trivia DB question and fix its answer order once, so going back to a
// question shows the options where they were
function toQuestion(item) {
  const correct = decodeHtml(item.correct_answer);
  return {
    question: decodeHtml(item.question),
    category: decodeHtml(item.category),
    difficulty: item.difficulty,
    correct,
    options:
      item.type === 'multiple'
        ? shuffle([correct, ...item.incorrect_answers.map((a) => decodeHtml(a))])
        : ['True', 'False'],
  };
}

function Solo({ settings, onSettingsChange, onProgress }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // question index -> answer the user submitted
  const [order, setOrder] = useState([]); // question indexes in the order they were answered
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const settingsRef = useRef(null);

  const total = questions.length;
  const answeredCount = order.length;
  const allAnswered = total > 0 && answeredCount === total;

  // One mark per question for the step row: correct, wrong or not answered yet
  const marks = useMemo(
    () =>
      questions.map((q, i) =>
        answers[i] === undefined ? undefined : answers[i] === q.correct ? 'correct' : 'wrong'
      ),
    [questions, answers]
  );
  const score = marks.filter((m) => m === 'correct').length;
  const streak = useMemo(() => streaks(order.map((i) => marks[i] === 'correct')), [order, marks]);

  // Report how the round is going, for the boards beside the quiz on wide screens
  const items = useMemo(
    () => questions.map((q, i) => ({ question: q.question, category: q.category, mark: marks[i] })),
    [questions, marks]
  );
  useEffect(() => {
    onProgress?.({
      answered: answeredCount,
      correct: score,
      total,
      streak: streak.current,
      index: currentIndex,
      items,
      jump: (i) => {
        setShowResults(false);
        setCurrentIndex(i);
      },
    });
  }, [answeredCount, score, total, streak, currentIndex, items, onProgress]);

  function handleAnswer(answer) {
    setAnswers((prev) => ({ ...prev, [currentIndex]: answer }));
    setOrder((prev) => [...prev, currentIndex]);
  }

  function generate() {
    setLoading(true);
    setError('');

    fetch(questionsUrl(settings))
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data.error || 'Failed to fetch questions');
        setQuestions(data.map(toQuestion));
        setCurrentIndex(0);
        setAnswers({});
        setOrder([]);
        setShowResults(false);
      })
      .catch((error) => {
        console.error('Error:', error);
        setError(error.message === 'Failed to fetch' ? 'Could not reach the server.' : error.message);
      })
      .finally(() => setLoading(false));
  }

  function changeSettings() {
    settingsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    settingsRef.current?.querySelector('input, select, button')?.focus({ preventScroll: true });
  }

  const current = questions[currentIndex];
  const streakNote = marks[currentIndex] === 'correct' && streak.current >= 2 && order.at(-1) === currentIndex
    ? `${streak.current} in a row.`
    : undefined;

  const missed = questions
    .map((q, i) => ({ index: i, question: q.question, category: q.category, answer: answers[i], correctAnswer: q.correct }))
    .filter((m) => marks[m.index] !== 'correct');

  return (
    <>
      <section className="board" aria-labelledby="solo-settings-title" ref={settingsRef}>
        <div className="board-head">
          <h2 className="board-title" id="solo-settings-title">Quiz settings</h2>
        </div>
        <div className="board-body">
          <Settings settings={settings} onChange={onSettingsChange} />
          <div className="board-actions">
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Loading…' : total > 0 ? 'Generate New Questions' : 'Generate Questions'}
            </button>
          </div>
          {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}
        </div>
      </section>

      {total === 0 && (
        <section className="board board-idle">
          <div className="board-body">
            <FlapText text="" length={10} label="" size="lg" />
            <p>Click "Generate Questions" to begin.</p>
          </div>
        </section>
      )}

      {total > 0 && showResults && (
        <ResultsBoard
          correct={score}
          total={total}
          stats={[
            { label: 'Accuracy', value: `${Math.round((score / total) * 100)}%` },
            { label: 'Best streak', value: streak.best },
          ]}
          missed={missed}
          share={shareText({
            title: `Quizzr · Solo · ${score}/${total}`,
            marks,
            lines: streak.best >= 2 ? [`Best streak: ${streak.best}`] : [],
            url: window.location.origin,
          })}
          actions={
            <>
              <button className="btn btn-primary" onClick={generate} disabled={loading}>
                <Icon name="replay" />
                {loading ? 'Loading…' : 'Play again'}
              </button>
              <button className="btn" onClick={() => setShowResults(false)}>
                Review questions
              </button>
              <button className="btn btn-ghost-quiet" onClick={changeSettings}>
                Change settings
              </button>
            </>
          }
        />
      )}

      {total > 0 && !showResults && (
        <QuestionCard
          index={currentIndex}
          total={total}
          category={current.category}
          difficulty={current.difficulty}
          question={current.question}
          options={current.options}
          picked={answers[currentIndex]}
          correctAnswer={current.correct}
          score={score}
          streak={streak.current}
          note={streakNote}
          marks={marks}
          finishAction={allAnswered ? { label: 'See results', onClick: () => setShowResults(true) } : undefined}
          onAnswer={handleAnswer}
          onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          onJump={setCurrentIndex}
        />
      )}
    </>
  );
}

export default Solo;
