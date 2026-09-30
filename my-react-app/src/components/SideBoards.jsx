import { useEffect, useRef } from 'react';
import FlapText from './FlapText';
import Icon from './Icon';
import RouteBadge from './RouteBadge';
import { categoryByName, lineNames } from '../categories';

const markLabel = { correct: 'correct', wrong: 'wrong', pending: 'checking', timeout: 'ran out of time' };

// Every question in the round as a departures list: number, line, question, result.
// The current question is lit, and any row jumps straight to its question.
export function AnswerLog({ progress }) {
  const { items = [], index = 0, jump } = progress ?? {};
  const listRef = useRef(null);
  const digits = Math.max(2, String(items.length).length);

  // Keep the current row in view inside the board without scrolling the page
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector('[aria-current="true"]');
    if (!row) return;
    if (row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
    }
  }, [index, items.length]);

  return (
    <section className="board" aria-labelledby="log-title">
      <div className="board-head">
        <h2 className="board-title" id="log-title">Answers</h2>
      </div>
      {items.length === 0 ? (
        <p className="log-empty">Your questions line up here once a quiz starts.</p>
      ) : (
        <ol className="answer-log" ref={listRef}>
          {items.map((item, i) => {
            const line = categoryByName(item.category);
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`log-row ${item.mark ?? ''}`}
                  aria-current={i === index ? 'true' : undefined}
                  aria-label={`Question ${i + 1}: ${item.question}${item.mark ? `, ${markLabel[item.mark]}` : ''}`}
                  onClick={() => jump?.(i)}
                >
                  <span className="log-num">{String(i + 1).padStart(digits, '0')}</span>
                  {line ? <RouteBadge code={line.code} line={line.line} size="sm" /> : <span />}
                  <span className="log-text">{item.question}</span>
                  <span className="log-mark">
                    {item.mark === 'correct' && <Icon name="check" size={16} />}
                    {(item.mark === 'wrong' || item.mark === 'timeout') && <Icon name="cross" size={16} />}
                    {item.mark === 'pending' && <Icon name="pending" size={16} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Boards that hang beside the quiz on wide screens. Each one shows something real:
// what the category colours mean, how the current round is going, and how to play.

export function LineMap() {
  return (
    <section className="board" aria-labelledby="lines-title">
      <div className="board-head">
        <h2 className="board-title" id="lines-title">Lines</h2>
      </div>
      <ul className="line-map">
        {Object.entries(lineNames).map(([line, name]) => (
          <li key={line} className={`route-${line}`}>
            <span className="line-swatch" aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RoundBoard({ progress }) {
  const { answered = 0, correct = 0, total = 0, streak = 0 } = progress ?? {};
  const started = total > 0;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const digits = Math.max(2, String(total).length);

  return (
    <section className="board" aria-labelledby="round-title">
      <div className="board-head">
        <h2 className="board-title" id="round-title">Your round</h2>
      </div>
      <dl className="round-stats">
        <div>
          <dt>Answered</dt>
          <dd>
            <FlapText
              text={started ? `${String(answered).padStart(digits, '0')}/${total}` : ''}
              length={digits * 2 + 1}
              label={started ? `${answered} of ${total}` : 'None yet'}
            />
          </dd>
        </div>
        <div>
          <dt>Correct</dt>
          <dd>
            <FlapText
              text={started ? String(correct).padStart(digits, '0') : ''}
              length={digits}
              label={started ? String(correct) : 'None yet'}
            />
          </dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>
            <FlapText
              text={started ? String(streak).padStart(2, '0') : ''}
              length={2}
              label={started ? `${streak} in a row` : 'None yet'}
            />
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>
            <FlapText
              text={answered > 0 ? `${accuracy}%` : ''}
              length={4}
              label={answered > 0 ? `${accuracy} percent` : 'None yet'}
            />
          </dd>
        </div>
      </dl>
      {!started && <p className="round-empty">Start a quiz and your numbers show up here.</p>}
    </section>
  );
}

const steps = {
  solo: [
    'Pick your settings, or keep the defaults.',
    'Generate a set of questions.',
    'Select an answer, then submit it.',
    'Answer them all, then see your results and share them.',
  ],
  daily: [
    'Enter a name for the leaderboard.',
    'Start the challenge. The clock starts too.',
    'Answer all 10. You get one go per day.',
    'Most correct wins; ties go to the fastest.',
  ],
  multi: [
    'Enter your name.',
    'Create a room, or join one with its 5-letter code.',
    'The host picks the settings and starts the game.',
    'Right answers score 100, plus up to 50 for speed.',
  ],
};

export function HowToPlay({ mode }) {
  return (
    <section className="board" aria-labelledby="howto-title">
      <div className="board-head">
        <h2 className="board-title" id="howto-title">How to play</h2>
      </div>
      <ol className="howto" key={mode}>
        {steps[mode].map((step, i) => (
          <li key={step} style={{ '--i': i }}>
            <span className="howto-num" aria-hidden="true">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
