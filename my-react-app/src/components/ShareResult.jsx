import { useState } from 'react';
import Icon from './Icon';

// Copy the old-fashioned way when the clipboard API isn't available (plain http, older browsers)
function copyWithTextarea(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

// The shareable result: a preview of exactly what gets shared, and one button.
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
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = copyWithTextarea(text);
    }
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <div className="share">
      <pre className="share-card" aria-label="Your shareable result">{text}</pre>
      <div className="share-actions">
        <button type="button" className="btn" onClick={share}>
          <Icon name="share" />
          {status === 'copied' ? 'Copied!' : 'Share result'}
        </button>
        <span className="share-status" role="status">
          {status === 'copied' && 'Result copied to your clipboard.'}
          {status === 'failed' && "Couldn't copy. Select the text above and copy it."}
        </span>
      </div>
    </div>
  );
}

export default ShareResult;
