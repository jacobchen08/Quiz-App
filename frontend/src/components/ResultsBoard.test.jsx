import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ResultsBoard from './ResultsBoard';

describe('ResultsBoard', () => {
  it('lists every missed question with both answers', () => {
    render(
      <ResultsBoard
        correct={1}
        total={3}
        stats={[{ label: 'Best streak', value: 1 }]}
        missed={[
          { index: 1, question: 'Capital of Australia?', category: 'Geography', answer: 'Sydney', correctAnswer: 'Canberra' },
          { index: 2, question: 'Largest planet?', category: 'Science & Nature', answer: undefined, correctAnswer: 'Jupiter' },
        ]}
        share="Quizzr · Solo · 1/3"
      />
    );

    expect(screen.getByText('1 out of 3 correct')).toBeInTheDocument();
    expect(screen.getByText('Missed (2)')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Sydney')).toBeInTheDocument();
    expect(within(items[0]).getByText('Canberra')).toBeInTheDocument();
    expect(within(items[1]).getByText('Not answered')).toBeInTheDocument();
    expect(screen.getByLabelText('Your shareable result')).toHaveTextContent('Quizzr · Solo · 1/3');
    expect(screen.getByRole('button', { name: /Share result/ })).toBeInTheDocument();
  });

  it('celebrates a clean sheet instead of an empty list', () => {
    render(<ResultsBoard correct={3} total={3} missed={[]} />);
    expect(screen.getByText('Nothing missed')).toBeInTheDocument();
    expect(screen.getByText('A perfect round.')).toBeInTheDocument();
  });
});
