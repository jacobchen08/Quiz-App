import { useEffect, useState, useSyncExternalStore } from 'react';
import FlapText from './FlapText';
import { getSnapshot, subscribe } from '../lib/serverStatus';

const WAKING_AFTER_SECONDS = 8;

// Shown while a request is taking a while, most likely because the server is waking up.
function WakeBanner() {
  const { slowSince } = useSyncExternalStore(subscribe, getSnapshot);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!slowSince) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [slowSince]);

  if (!slowSince) return null;
  const seconds = Math.max(0, Math.floor((now - slowSince) / 1000));
  // A few seconds is usually the trivia service asking us to wait; much longer is the server starting up
  const waking = seconds >= WAKING_AFTER_SECONDS;

  return (
    <section className="board wake" role="status" aria-label={waking ? 'Waking the server up' : 'Still loading'}>
      <div className="board-body">
        <FlapText text={String(seconds).padStart(2, '0')} label="" size="lg" className="wake-seconds" />
        <div>
          <p className="wake-title">{waking ? 'Waking the server up…' : 'Still working on it…'}</p>
          <p className="wake-text">
            {waking
              ? "Quizzr runs on free hosting that sleeps when nobody's playing. Starting it again usually takes 30 to 60 seconds, and your request goes through as soon as it's up."
              : 'This is taking a little longer than usual. No need to click again.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default WakeBanner;
