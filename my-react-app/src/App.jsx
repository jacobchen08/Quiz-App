import './App.css';
import { useCallback, useRef, useState } from 'react';
import useIndicator from './useIndicator';
import Solo from './Solo';
import Multiplayer from './Multiplayer';
import Daily from './Daily';
import { AnswerLog, HowToPlay, LineMap, RoundBoard } from './components/SideBoards';

const defaultSettings = { amount: 10, category: '', difficulty: '', type: '' };

// start the backend:  cd backend  then  uvicorn apicall:app --reload --port 8000
// start the frontend: cd my-react-app  then  npm run dev

//to do list: Make the user be able to see their score at the end of the quiz. Make the user be able to restart the quiz.

// Open on multiplayer for an invite link, or when this tab was in a room before a reload
function hasSeat() {
  try {
    return Boolean(sessionStorage.getItem('quizzr-seat'));
  } catch {
    return false;
  }
}
const startInMultiplayer = new URLSearchParams(window.location.search).has('room') || hasSeat();

function App() {
  const [mode, setMode] = useState(startInMultiplayer ? 'multi' : 'solo');
  const [settings, setSettings] = useState(defaultSettings);
  const tabsRef = useRef(null);
  const sign = useIndicator(tabsRef, '[aria-selected="true"]', [mode]);

  // Each mode reports its round so the board beside the quiz can show it
  const [progress, setProgress] = useState({ solo: null, daily: null, multi: null });
  const onSoloProgress = useCallback((p) => setProgress((prev) => ({ ...prev, solo: p })), []);
  const onDailyProgress = useCallback((p) => setProgress((prev) => ({ ...prev, daily: p })), []);
  const onMultiProgress = useCallback((p) => setProgress((prev) => ({ ...prev, multi: p })), []);

  return (
    <div className="App">
      <header className="header">
        <h1>Quizzr</h1>
        <p>Quiz web app designed with Python, React, and FastAPI, utilizing Open Trivia DB's API for trivia questions.</p>
      </header>

      {/* Wide screens only: boards hung on the wall either side of the quiz */}
      <aside className="rail rail-left" aria-label="Answers and category lines">
        <div className="rail-inner">
          <AnswerLog progress={progress[mode]} />
          <LineMap />
        </div>
      </aside>

      <div className="main-col">
        <div className="mode-tabs" role="tablist" aria-label="Game mode" ref={tabsRef} style={sign ?? undefined}>
          {/* the platform sign slides to whichever mode is selected */}
          {sign && <span className="mode-sign" aria-hidden="true" />}
          <button role="tab" aria-selected={mode === 'solo'} onClick={() => setMode('solo')}>
            Solo
          </button>
          <button role="tab" aria-selected={mode === 'daily'} onClick={() => setMode('daily')}>
            Daily
          </button>
          <button role="tab" aria-selected={mode === 'multi'} onClick={() => setMode('multi')}>
            Multiplayer
          </button>
        </div>

        {/* All stay mounted so switching tabs doesn't lose your quiz or kick you out of a room */}
        <div className="mode-panel" hidden={mode !== 'solo'}>
          <Solo settings={settings} onSettingsChange={setSettings} onProgress={onSoloProgress} />
        </div>
        <div className="mode-panel" hidden={mode !== 'daily'}>
          <Daily onProgress={onDailyProgress} />
        </div>
        <div className="mode-panel" hidden={mode !== 'multi'}>
          <Multiplayer settings={settings} onSettingsChange={setSettings} onProgress={onMultiProgress} />
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
