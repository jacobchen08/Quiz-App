import { useState } from 'react';
import Icon from './Icon';
import { copyText } from '../lib/clipboard';

const SQUARES = { '🟩': 'correct', '🟥': 'wrong', '⬜': 'none' };
const isSquaresLine = (line) => line.length > 0 && [...line].every((ch) => ch in SQUARES);

// The printed slip: the shared text line by line, except the coloured squares, which are
// shown as tiles with a tick or cross so the result never rests on colour alone
function Ticket({ text }) {
  return (
    <div className="share-card" aria-label="Your shareable result">
      {text.split('\n').map((line, i) =>
        isSquaresLine(line) ? (
          <ol key={i} className="share-marks" aria-label="Question by question">
            {[...line].map((ch, n) => {
              const mark = SQUARES[ch];
              return (
                <li key={n} className={`share-mark ${mark}`}>
                  {mark === 'correct' && <Icon name="check" size={14} />}
                  {mark === 'wrong' && <Icon name="cross" size={14} />}
                  <span className="sr-only">
                    Question {n + 1}: {mark === 'none' ? 'not answered' : mark}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p key={i} className={i === 0 ? 'share-title' : 'share-line'}>{line}</p>
        )
      )}
    </div>
  );
}

// The shareable result: a preview of what gets shared, and one button.
// Phones open the system share sheet; everything else copies to the clipboard.
function ShareResult({ text }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed

  async function share() {
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // they closed the share sheet
      }
    }
    const ok = await copyText(text);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <div className="share">
      <Ticket text={text} />
      <div className="share-actions">
        <button type="button" className="btn" onClick={share}>
          <Icon name="share" />
          {status === 'copied' ? 'Copied!' : 'Share result'}
        </button>
        <span className="share-status" role="status">
          {status === 'copied' && 'Result copied to your clipboard.'}
          {status === 'failed' && "Couldn't copy it here. Try another browser, or share a screenshot."}
        </span>
      </div>
    </div>
  );
}

export default ShareResult;
