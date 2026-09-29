import { useRef } from 'react';
import Icon from './Icon';
import RouteBadge from './RouteBadge';
import useIndicator from '../useIndicator';
import { categories, categoryById } from '../categories';

// `pips` gives each difficulty a count as well as a colour, so it never relies on colour alone
const difficulties = [
  { value: '', label: 'Any' },
  { value: 'easy', label: 'Easy', accent: 'teal', pips: 1 },
  { value: 'medium', label: 'Medium', accent: 'orange', pips: 2 },
  { value: 'hard', label: 'Hard', accent: 'magenta', pips: 3 },
];

// Listed A–Z in the picker ("Any Category" stays first)
const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

const types = [
  { value: '', label: 'Any' },
  { value: 'multiple', label: 'Multiple choice' },
  { value: 'boolean', label: 'True / False' },
];

// A row of labeled switch positions with one thumb that slides to the chosen one
// (radio buttons underneath)
function Switch({ legend, name, options, value, onChange }) {
  const trackRef = useRef(null);
  const thumb = useIndicator(trackRef, '.switch-pos:has(input:checked)', [value]);
  const current = options.find((o) => o.value === value);

  return (
    <fieldset className="field switch">
      <legend>{legend}</legend>
      <div className="switch-track" ref={trackRef} style={thumb ?? undefined}>
        {thumb && <span className={`switch-thumb${current?.accent ? ` accent-${current.accent}` : ''}`} aria-hidden="true" />}
        {options.map((option) => (
          <label key={option.value} className={`switch-pos${thumb ? '' : ' no-thumb'}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.pips && (
              <span className={`pips accent-${option.accent}`} aria-hidden="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={i < option.pips ? 'on' : ''} />
                ))}
              </span>
            )}
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Number of questions, category, difficulty and question type
function Settings({ settings, onChange, idPrefix = "" }) {
  const category = categoryById(settings.category);

  function update(key, value) {
    onChange({ ...settings, [key]: value });
  }

  function step(delta) {
    const current = Number(settings.amount) || 0;
    update('amount', Math.min(50, Math.max(1, current + delta)));
  }

  return (
    <div className="settings-grid">
      <div className="field">
        <label htmlFor={`${idPrefix}num-questions`}>Number of questions (1–50)</label>
        <div className="counter">
          <button type="button" className="counter-key" onClick={() => step(-1)} aria-label="One fewer question">
            <Icon name="minus" />
          </button>
          <input
            id={`${idPrefix}num-questions`}
            type="number"
            value={settings.amount}
            min="1"
            max="50"
            onChange={(e) => update('amount', e.target.value)}
          />
          <button type="button" className="counter-key" onClick={() => step(1)} aria-label="One more question">
            <Icon name="plus" />
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}category`}>Category</label>
        <div className="select-wrap">
          <RouteBadge code={category.code} line={category.line} />
          <select id={`${idPrefix}category`} value={settings.category} onChange={(e) => update('category', e.target.value)}>
            <option value="">Any Category</option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Icon name="chevron-down" className="select-chevron" />
        </div>
      </div>

      <Switch
        legend="Difficulty"
        name={`${idPrefix}difficulty`}
        options={difficulties}
        value={settings.difficulty}
        onChange={(value) => update('difficulty', value)}
      />

      <Switch
        legend="Question type"
        name={`${idPrefix}type`}
        options={types}
        value={settings.type}
        onChange={(value) => update('type', value)}
      />
    </div>
  );
}

export default Settings;
