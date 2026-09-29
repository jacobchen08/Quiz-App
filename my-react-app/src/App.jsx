import './App.css';
import { useRef, useState } from 'react';
import useIndicator from './useIndicator';
import Solo from './Solo';
import Multiplayer from './Multiplayer';

const defaultSettings = { amount: 10, category: '', difficulty: '', type: '' };

// start the backend:  cd backend  then  uvicorn apicall:app --reload --port 8000
// start the frontend: cd my-react-app  then  npm run dev

//to do list: Make the user be able to see their score at the end of the quiz. Make the user be able to restart the quiz.

const startInMultiplayer = new URLSearchParams(window.location.search).has('room');

function App() {
  const [mode, setMode] = useState(startInMultiplayer ? 'multi' : 'solo');
  const [settings, setSettings] = useState(defaultSettings);
  const tabsRef = useRef(null);
  const sign = useIndicator(tabsRef, '[aria-selected="true"]', [mode]);

  return (
    <div className="App">
      <header className="header">
        <h1>Quizzr</h1>
        <p>Quiz web app designed with Python, React, and FastAPI, utilizing Open Trivia DB's API for trivia questions.</p>
      </header>

      <div className="mode-tabs" role="tablist" aria-label="Game mode" ref={tabsRef} style={sign ?? undefined}>
        {/* the platform sign slides to whichever mode is selected */}
        {sign && <span className="mode-sign" aria-hidden="true" />}
        <button role="tab" aria-selected={mode === 'solo'} onClick={() => setMode('solo')}>
          Solo
        </button>
        <button role="tab" aria-selected={mode === 'multi'} onClick={() => setMode('multi')}>
          Multiplayer
        </button>
      </div>

      {/* Both stay mounted so switching tabs doesn't lose your quiz or kick you out of a room */}
      <div className="mode-panel" hidden={mode !== 'solo'}>
        <Solo settings={settings} onSettingsChange={setSettings} />
      </div>
      <div className="mode-panel" hidden={mode !== 'multi'}>
        <Multiplayer settings={settings} onSettingsChange={setSettings} />
      </div>
    </div>
  );
}

export default App;
