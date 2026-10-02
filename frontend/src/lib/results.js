// Scoring and results helpers shared by solo, daily and multiplayer.

// `outcomes` is a list of true/false in the order the answers were given.
// Returns the run of correct answers still going and the longest run.
export function streaks(outcomes) {
  let current = 0;
  let best = 0;
  for (const correct of outcomes) {
    current = correct ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return { current, best };
}

// A one-line verdict for the results board
export function verdict(correct, total) {
  if (total === 0) return '';
  const share = correct / total;
  if (share === 1) return 'A perfect round.';
  if (share >= 0.8) return 'Excellent round.';
  if (share >= 0.5) return 'Solid round.';
  if (share > 0) return 'A tough one. Try another?';
  return 'Nothing went your way this time. Try another?';
}

// 1:05 style, for daily times
export function formatSeconds(seconds) {
  if (seconds == null) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// The text people paste into a chat: a title line, one square per question, then the link.
// `marks` has one entry per question: 'correct', 'wrong', or anything else for unanswered.
export function shareText({ title, marks, lines = [], url }) {
  const squares = marks.map((m) => (m === 'correct' ? '🟩' : m === 'wrong' ? '🟥' : '⬜')).join('');
  return [title, squares, ...lines, url].filter(Boolean).join('\n');
}

export function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}

// Every mode keeps one mark per question: 'correct', 'wrong', 'pending' (sent, waiting on the
// server), 'timeout' (time ran out) or undefined (not answered yet). These say each in words,
// for screen readers on the step row and the Answers board.
export const markLabels = { correct: 'correct', wrong: 'wrong', pending: 'checking', timeout: 'ran out of time' };

// The note under a correct answer that keeps a streak of two or more going
export function streakNote(streak, isLatestAnswerCorrect) {
  return isLatestAnswerCorrect && streak >= 2 ? `${streak} in a row.` : undefined;
}

// What the results board lists under "Missed": every question not answered correctly.
// `answerFor(i)` gives { answer, correctAnswer } for question i.
export function missedQuestions(questions, marks, answerFor) {
  return questions
    .map((q, i) => ({ index: i, question: q.question, category: q.category, ...answerFor(i) }))
    .filter((m) => marks[m.index] !== 'correct');
}
