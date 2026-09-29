import { useEffect, useRef } from 'react';
import FlapText from './FlapText';
import Icon from './Icon';
import RouteBadge from './RouteBadge';
import ShareResult from './ShareResult';
import { categoryByName } from '../categories';
import { verdict } from '../results';

// The end of a round: the score flips in big, then the numbers that matter, every question
// you missed with the right answer, a shareable result, and what to do next.
// `stats` is a list of { label, value }; `missed` lists { index, question, category, answer, correctAnswer }.
function ResultsBoard({ title = 'Your results', correct, total, stats = [], missed = [], share, actions, note }) {
  const headingRef = useRef(null);
  const digits = String(total).length;

  // Bring the results into view and give keyboard and screen reader users a place to start
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  return (
    <section className="board results" aria-labelledby="results-heading">
      <div className="board-head">
        <h2 className="board-title" id="results-heading" ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
      </div>

      <div className="board-body">
        <div className="results-score">
          <FlapText
            text={`${String(correct).padStart(digits, '0')}/${total}`}
            label={`${correct} out of ${total} correct`}
            size="xl"
          />
          <p className="results-verdict">{verdict(correct, total)}</p>
        </div>

        {stats.length > 0 && (
          <dl className="results-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {note && <p className="results-note">{note}</p>}

        <h3 className="results-subhead">
          {missed.length === 0 ? 'Nothing missed' : `Missed (${missed.length})`}
        </h3>
        {missed.length === 0 ? (
          <p className="muted-text">Every answer you gave was right.</p>
        ) : (
          <ol className="missed">
            {missed.map((m) => {
              const line = categoryByName(m.category);
              return (
                <li key={m.index}>
                  <p className="missed-question">
                    <span className="missed-num">{m.index + 1}</span>
                    {line && <RouteBadge code={line.code} line={line.line} size="sm" />}
                    <span>{m.question}</span>
                  </p>
                  <p className="missed-answer is-wrong">
                    <Icon name="cross" size={16} />
                    <span>
                      <span className="sr-only">Your answer: </span>
                      {m.answer ?? 'Not answered'}
                    </span>
                  </p>
                  <p className="missed-answer is-right">
                    <Icon name="check" size={16} />
                    <span>
                      <span className="sr-only">Correct answer: </span>
                      {m.correctAnswer}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {share && <ShareResult text={share} />}

        {actions && <div className="results-actions">{actions}</div>}
      </div>
    </section>
  );
}

export default ResultsBoard;
