import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings, { SettingsSummary } from './Settings';

const defaults = { amount: 10, category: '', difficulty: '', type: '', timer: '' };

describe('Settings', () => {
  it('offers a time limit that starts switched off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Settings settings={defaults} onChange={onChange} />);

    const group = screen.getByRole('group', { name: 'Time per question' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: '20 sec' }));
    expect(onChange).toHaveBeenCalledWith({ ...defaults, timer: '20' });
  });
});

describe('SettingsSummary', () => {
  it("spells out the host's choices for everyone else", () => {
    render(
      <SettingsSummary settings={{ amount: 15, category: '23', difficulty: 'hard', type: 'boolean', timer: '10' }} />
    );
    const expected = {
      Questions: '15',
      Category: 'History',
      Difficulty: 'Hard',
      'Question type': 'True / False',
      'Time per question': '10 sec',
    };
    for (const [term, value] of Object.entries(expected)) {
      expect(screen.getByText(term).nextElementSibling).toHaveTextContent(value);
    }
  });

  it('says Off and Any when nothing is chosen', () => {
    render(<SettingsSummary settings={defaults} />);
    expect(screen.getByText('Time per question').nextElementSibling).toHaveTextContent('Off');
    expect(screen.getByText('Category').nextElementSibling).toHaveTextContent('Any Category');
  });
});
