import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionCard from './QuestionCard';

function renderCard(props = {}) {
  const onAnswer = vi.fn();
  const utils = render(
    <QuestionCard
      index={0}
      total={3}
      category="History"
      difficulty="medium"
      question="In what year did the Berlin Wall fall?"
      options={['1987', '1989', '1991', '1993']}
      picked={undefined}
      correctAnswer="1989"
      score={0}
      marks={[undefined, undefined, undefined]}
      onAnswer={onAnswer}
      onPrevious={() => {}}
      onNext={() => {}}
      onJump={() => {}}
      {...props}
    />
  );
  return { onAnswer, ...utils };
}

describe('QuestionCard', () => {
  it('only counts an answer once it is submitted', async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderCard();
    const submit = screen.getByRole('button', { name: 'Submit answer' });

    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /1987/ }));
    await user.click(screen.getByRole('button', { name: /1989/ })); // changed their mind
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /1989/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /1987/ })).toHaveAttribute('aria-pressed', 'false');

    await user.click(submit);
    expect(onAnswer).toHaveBeenCalledOnce();
    expect(onAnswer).toHaveBeenCalledWith('1989');
  });

  it('shows the result in words, not only colour, once answered', () => {
    renderCard({ picked: '1987', marks: ['wrong', undefined, undefined], note: '3 in a row.' });
    expect(screen.getByRole('status')).toHaveTextContent('Not quite. The answer is 1989.');
    expect(screen.getByText('Your answer')).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
    for (const option of ['1987', '1989', '1991', '1993']) {
      expect(screen.getByRole('button', { name: new RegExp(option) })).toBeDisabled();
    }
  });

  it('shows the category, difficulty and streak', () => {
    renderCard({ streak: 3 });
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Streak: 3 in a row')).toBeInTheDocument();
  });

  it('offers the finish action in place of Next when the round is done', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard({ index: 2, picked: '1989', finishAction: { label: 'See results', onClick } });
    expect(screen.queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /See results/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('jumps to a question from the step row', async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    renderCard({ onJump, marks: ['correct', undefined, undefined] });
    await user.click(screen.getByRole('button', { name: 'Question 3' }));
    expect(onJump).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Question 1, correct' })).toHaveAttribute('aria-current', 'step');
  });
});
