import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import OfflineBanner from './components/OfflineBanner';
import { AnswerLog, HowToPlay, LineMap, RoundBoard } from './components/SideBoards';
import WakeBanner from './components/WakeBanner';
import useIndicator from './hooks/useIndicator';
import { prefersReducedMotion } from './lib/motion';
import { refillPack } from './lib/offlinePack';
import { hasSeat } from './lib/seat';
import { DEFAULT_SETTINGS } from './lib/settings';
import Daily from './modes/daily/Daily';
import Multiplayer from './modes/multiplayer/Multiplayer';
import Solo from './modes/solo/Solo';

// The whole page: the station sign with the mode tabs, the three modes, and the side boards
// that hang beside them on wide screens. Each mode is its own component in modes/.

// Open on multiplayer for an invite link, or when this tab was in a room before a reload
const startInMultiplayer = new URLSearchParams(window.location.search).has('room') || hasSeat();

const MODES = [
  { id: 'solo', label: 'Solo' },
  { id: 'daily', label: 'Daily' },
  { id: 'multi', label: 'Multiplayer' },
];

function App() {
  const [mode, setMode] = useState(startInMultiplayer ? 'multi' : 'solo');
  // Solo and multiplayer each keep their own settings, so changing one never changes the other
  const [soloSettings, setSoloSettings] = useState(DEFAULT_SETTINGS);
  const [roomSettings, setRoomSettings] = useState(DEFAULT_SETTINGS);
  const tabsRef = useRef(null);
  // Tabs keyboard pattern: arrows (and Home / End) move between modes, focus follows
  function onTabKey(event) {
    const at = MODES.findIndex((m) => m.id === mode);
    const next = {
      ArrowRight: (at + 1) % MODES.length,
      ArrowLeft: (at - 1 + MODES.length) % MODES.length,
      Home: 0,
      End: MODES.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setMode(MODES[next].id);
    document.getElementById(`tab-${MODES[next].id}`)?.focus();
  }

  const sign = useIndicator(tabsRef, '[aria-selected="true"]', [mode]);

  // Each mode reports its round so the board beside the quiz can show it
  const [progress, setProgress] = useState({ solo: null, daily: null, multi: null });
  const onSoloProgress = useCallback((p) => setProgress((prev) => ({ ...prev, solo: p })), []);
  const onDailyProgress = useCallback((p) => setProgress((prev) => ({ ...prev, daily: p })), []);
  const onMultiProgress = useCallback((p) => setProgress((prev) => ({ ...prev, multi: p })), []);

  // The boards swing onto the wall once, as the page opens. Boards that appear later (another
  // mode, a question, the results) just drop in (styles/layout.css). The swing is played from
  // here rather than from CSS so that nothing restarts once it has finished.
  const mainRef = useRef(null);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const boards = mainRef.current?.querySelectorAll('.mode-panel:not([hidden]) > *') ?? [];
    boards.forEach((board, i) =>
      board.animate?.(
        [
          { opacity: 0, transform: 'perspective(1400px) translateY(-14px) rotateX(9deg)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 520, delay: Math.min(i, 3) * 70, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      )
    );
  }, []);

  // Keep a pack of questions saved for offline solo play. It waits until the page has settled
  // (so it never competes with the first quiz for the trivia service's one-request-per-five-
  // seconds allowance), and tops up again whenever the connection comes back.
  useEffect(() => {
    const delay = Number(import.meta.env.VITE_OFFLINE_PACK_DELAY ?? 15000);
    const timer = setTimeout(refillPack, delay);
    window.addEventListener('online', refillPack);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', refillPack);
    };
  }, []);

  return (
    <div className="App">
      <header className="header">
        {/* The station sign: an enamel plate with the name and the mode switch */}
        <div className="sign">
          <h1>Quizzr</h1>
          <div className="mode-tabs" role="tablist" aria-label="Game mode" ref={tabsRef} style={sign ?? undefined}>
            {/* the platform sign slides to whichever mode is selected */}
            {sign && <span className="mode-sign" aria-hidden="true" />}
            {MODES.map((m) => (
              <button
                key={m.id}
                id={`tab-${m.id}`}
                role="tab"
                aria-selected={mode === m.id}
                aria-controls={`panel-${m.id}`}
                tabIndex={mode === m.id ? 0 : -1}
                onClick={() => setMode(m.id)}
                onKeyDown={onTabKey}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p>Trivia on a departure board. Play a round on your own, take today's challenge, or start a room with friends.</p>
      </header>

      {/* Wide screens only: boards hung on the wall either side of the quiz */}
      <aside className="rail rail-left" aria-label="Answers and category lines">
        <div className="rail-inner">
          <AnswerLog progress={progress[mode]} />
          <LineMap />
        </div>
      </aside>

      <div className="main-col" ref={mainRef}>
        <WakeBanner />
        <OfflineBanner />

        {/* All stay mounted so switching tabs doesn't lose your quiz or kick you out of a room */}
        <div className="mode-panel" id="panel-solo" role="tabpanel" aria-labelledby="tab-solo" hidden={mode !== 'solo'}>
          <Solo settings={soloSettings} onSettingsChange={setSoloSettings} onProgress={onSoloProgress} />
        </div>
        <div className="mode-panel" id="panel-daily" role="tabpanel" aria-labelledby="tab-daily" hidden={mode !== 'daily'}>
          <Daily onProgress={onDailyProgress} />
        </div>
        <div className="mode-panel" id="panel-multi" role="tabpanel" aria-labelledby="tab-multi" hidden={mode !== 'multi'}>
          <Multiplayer settings={roomSettings} onSettingsChange={setRoomSettings} onProgress={onMultiProgress} />
        </div>
      </div>

      <aside className="rail rail-right" aria-label="Your round and how to play">
        <div className="rail-inner">
          <RoundBoard progress={progress[mode]} />
          <HowToPlay mode={mode} />
        </div>
      </aside>
    </div>
  );
}

export default App;
