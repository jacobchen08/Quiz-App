import { useState } from 'react';
import FlapText from './FlapText';
import Icon from './Icon';
import RouteBadge from './RouteBadge';
import Pips from './Pips';
import { categoryByName, difficultyByValue } from '../categories';

// Shows one question with its answer buttons. Used by both solo and multiplayer.
// `picked` is the answer the player chose (undefined until they answer) and
// `correctAnswer` is only needed once they have answered.
// `marks` has one entry per question: 'correct', 'wrong', 'pending' or undefined.

const markLabel = { correct: 'correct', wrong: 'wrong', pending: 'checking' };

function StepRow({ total, index, marks, onJump }) {
  return (
    <ol className="steps" aria-label="Questions">
      {Array.from({ length: total }, (_, i) => {
        const mark = marks[i];
        return (
          <li key={i}>
            <button
              type="button"
              className={`step ${mark ?? ''}`}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`Question ${i + 1}${mark ? `, ${markLabel[mark]}` : ''}`}
              onClick={() => onJump(i)}
            >
              {mark === 'correct' && <Icon name="check" size={14} />}
              {mark === 'wrong' && <Icon name="cross" size={14} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function QuestionCard({
  index,
  total,
  category,
  difficulty,
  question,
  options,
  picked,
  correctAnswer,
  score,
  scoreSuffix = `/ ${total}`,
  scoreDigits,
  scoreLabel = `Score: ${score} / ${total}`,
  streak = 0,
  note,
  finishAction,
  marks,
  onAnswer,
  onPrevious,
  onNext,
  onJump,
}) {
  const isAnswered = picked !== undefined;
  const line = categoryByName(category);
  const level = difficultyByValue(difficulty);

  // Clicking an answer only selects it; nothing counts until the player submits.
  // The selection belongs to one question, so moving to another starts fresh.
  const [selection, setSelection] = useState({ index, option: null });
  const selected = !isAnswered && selection.index === index ? selection.option : null;

  function submit() {
    if (selected !== null) onAnswer(selected);
  }

  // Which way the player moved, so the next question slides in from that side
  const [move, setMove] = useState({ index, direction: 'right' });
  if (move.index !== index) {
    setMove({ index, direction: index < move.index ? 'left' : 'right' });
  }
  const direction = move.direction;

  const digits = String(total).length < 2 ? 2 : String(total).length;

  function answerState(option) {
    if (!isAnswered) return option === selected ? 'selected' : '';
    if (correctAnswer === undefined) return option === picked ? 'pending' : 'dimmed'; // waiting on the server
    if (option === correctAnswer) return 'correct';
    if (option === picked) return 'wrong';
    return 'dimmed';
  }

  return (
    <section className="board" aria-label={`Question ${index + 1} of ${total}`}>
      <div className="board-head quiz-head">
        <div className="readout">
          <span className="readout-label">Question</span>
          <span className="readout-value">
            <FlapText text={String(index + 1).padStart(digits, '0')} label={`Question ${index + 1}`} size="lg" />
            <span className="readout-of">of {total}</span>
          </span>
        </div>
        <div className="readout-group">
          <div className={`readout readout-end readout-streak${streak >= 2 ? ' is-hot' : ''}`}>
            <span className="readout-label">Streak</span>
            <span className="readout-value">
              <FlapText text={String(streak).padStart(2, '0')} label={`Streak: ${streak} in a row`} size="lg" />
            </span>
          </div>
          <div className="readout readout-end">
            <span className="readout-label">Score</span>
            <span className="readout-value">
              <FlapText
                text={String(score).padStart(scoreDigits ?? digits, '0')}
                label={scoreLabel}
                size="lg"
              />
              <span className="readout-of">{scoreSuffix}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="board-body">
        <StepRow total={total} index={index} marks={marks} onJump={onJump} />

        {/* Keyed on the question so each new one slides in from the side you moved towards */}
        <div key={index} className={`question-stage from-${direction}`}>
        {(category || level) && (
          <div className="question-meta">
            {category && (
              <p className="category-tag">
                {line && <RouteBadge code={line.code} line={line.line} size="sm" />}
                {category}
              </p>
            )}
            {level && (
              <p className="difficulty-tag">
                <Pips count={level.pips} accent={level.accent} />
                <span className="sr-only">Difficulty: </span>
                {level.label}
              </p>
            )}
          </div>
        )}
        <p className="question">{question}</p>

        <div className="answers" role="group" aria-label="Answers">
          {options.map((option, i) => {
            const state = answerState(option);
            return (
              <button
                key={option}
                style={{ '--i': i }}
                className={`answer ${state}`}
                aria-pressed={isAnswered ? undefined : option === selected}
                onClick={() => setSelection({ index, option })}
                disabled={isAnswered}
              >
                <span className="answer-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <span className="answer-text">{option}</span>
                {state === 'correct' && (
                  <span className="answer-status"><Icon name="check" />Correct</span>
                )}
                {state === 'wrong' && (
                  <span className="answer-status"><Icon name="cross" />Your answer</span>
                )}
                {state === 'pending' && (
                  <span className="answer-status"><Icon name="pending" />Checking</span>
                )}
              </button>
            );
          })}
        </div>
        </div>

        {!isAnswered && (
          <div className="submit-row">
            <p className="submit-hint" aria-live="polite">
              {selected === null ? 'Pick an answer, then submit it.' : `Your answer: ${selected}`}
            </p>
            <button className="btn btn-primary" onClick={submit} disabled={selected === null}>
              Submit answer
            </button>
          </div>
        )}

        <div className="feedback-slot" role="status">
          {isAnswered && correctAnswer !== undefined && (
            <p className={`feedback ${picked === correctAnswer ? 'correct' : 'wrong'}`}>
              <Icon name={picked === correctAnswer ? 'check' : 'cross'} size={20} />
              <span>
                {picked === correctAnswer ? 'Correct!' : `Not quite. The answer is ${correctAnswer}.`}
                {note && <span className="feedback-note"> {note}</span>}
              </span>
            </p>
          )}
        </div>

        <div className="nav">
          <button className="btn" onClick={onPrevious} disabled={index === 0}>
            <Icon name="arrow-left" />
            Previous
          </button>
          {finishAction ? (
            <button className="btn btn-primary btn-finish" onClick={finishAction.onClick}>
              {finishAction.label}
              <Icon name="arrow-right" />
            </button>
          ) : (
            <button className="btn" onClick={onNext} disabled={index >= total - 1}>
              Next
              <Icon name="arrow-right" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default QuestionCard;
