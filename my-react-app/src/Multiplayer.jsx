import { useEffect, useRef, useState } from 'react';
import { roomSocketUrl } from './api';
import Settings from './components/Settings';
import QuestionCard from './components/QuestionCard';
import FlapText from './components/FlapText';
import Icon from './components/Icon';
import { lines } from './categories';

// Multiplayer: one player creates a room and shares the code, everyone answers the
// same questions at their own pace, and scores update live for everyone.
// The server (backend/multiplayer.py) checks answers so nobody can peek at them.

const initialCode = new URLSearchParams(window.location.search).get('room') || '';

function Multiplayer({ settings, onSettingsChange }) {
  const [name, setName] = useState('');
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const [phase, setPhase] = useState('menu'); // menu | connecting | room
  const [error, setError] = useState('');

  const [myId, setMyId] = useState(null);
  const [room, setRoom] = useState(null); // latest "state" message from the server
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState({}); // question index -> { answer, correct, correctAnswer }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef(null);

  // Leave the room if this component goes away
  useEffect(() => () => socketRef.current?.close(), []);

  function resetRoom() {
    setMyId(null);
    setRoom(null);
    setQuestions([]);
    setResults({});
    setCurrentIndex(0);
  }

  function connect(code) {
    setPhase('connecting');
    setError('');

    const socket = new WebSocket(roomSocketUrl(code));
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', name: name.trim() }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'welcome':
          setMyId(message.playerId);
          setPhase('room');
          break;
        case 'state':
          setRoom(message);
          break;
        case 'questions':
          setQuestions(message.questions);
          setResults({});
          setCurrentIndex(0);
          break;
        case 'answer_result':
          setResults((prev) => ({ ...prev, [message.index]: message }));
          break;
        case 'error':
          setError(message.message);
          break;
      }
    };

    socket.onclose = () => {
      // Only reset if this wasn't a deliberate "Leave room"
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      resetRoom();
      setPhase('menu');
      setError((prev) => prev || 'Disconnected from the room.');
    };
  }

  async function createRoom() {
    if (!name.trim()) return setError('Enter your name first.');
    setError('');
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();
      connect(data.code);
    } catch {
      setError('Could not reach the server.');
    }
  }

  function joinRoom() {
    if (!name.trim()) return setError('Enter your name first.');
    const code = codeInput.trim().toUpperCase();
    if (!code) return setError('Enter a room code.');
    connect(code);
  }

  function leaveRoom() {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    resetRoom();
    setPhase('menu');
    setError('');
  }

  function send(message) {
    socketRef.current?.send(JSON.stringify(message));
  }

  function startGame() {
    setError('');
    send({ type: 'start', settings });
  }

  function answer(option) {
    // Mark as picked right away so it can't be clicked twice; the server fills in the result
    setResults((prev) => ({ ...prev, [currentIndex]: { answer: option } }));
    send({ type: 'answer', index: currentIndex, answer: option });
  }

  function copyInvite() {
    const link = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // ---------- Join / create screen ----------
  if (phase !== 'room' || !room) {
    const connecting = phase === 'connecting';
    return (
      <section className="board" aria-labelledby="mp-title">
        <div className="board-head">
          <h2 className="board-title" id="mp-title">Play with friends</h2>
        </div>
        <div className="board-body">
          <div className="field name-field">
            <label htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              type="text"
              maxLength={20}
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="join-grid">
            <div className="join-option">
              <h3 className="join-heading">Start a new room</h3>
              <p className="muted-text">You'll be the host and pick the quiz settings.</p>
              <button className="btn btn-primary" onClick={createRoom} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Create room'}
              </button>
            </div>

            <div className="join-divider"><span>or</span></div>

            <div className="join-option">
              <h3 className="join-heading">Join a room</h3>
              {/* A real text input sits over five flap tiles that show what's typed */}
              <div className="code-slot">
                <input
                  className="code-input"
                  type="text"
                  maxLength={5}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="Room code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                />
                <span className="code-tiles" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`flap${i === Math.min(codeInput.length, 4) ? ' is-next' : ''}`}>
                      <span className="flap-char">{codeInput[i] || ' '}</span>
                    </span>
                  ))}
                </span>
              </div>
              <button className="btn btn-primary" onClick={joinRoom} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Join room'}
              </button>
            </div>
          </div>

          {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}
        </div>
      </section>
    );
  }

  // ---------- Inside a room ----------
  const isHost = room.hostId === myId;
  const host = room.players.find((p) => p.id === room.hostId);
  const me = room.players.find((p) => p.id === myId);
  const total = questions.length;
  const myAnsweredCount = Object.values(results).filter((r) => r.correctAnswer !== undefined).length;
  const iAmDone = total > 0 && myAnsweredCount === total;
  const current = questions[currentIndex];
  // One mark per question for the step row
  const marks = questions.map((_, i) => {
    const result = results[i];
    if (!result) return undefined;
    if (result.correctAnswer === undefined) return 'pending';
    return result.correct ? 'correct' : 'wrong';
  });
  const hostControls = isHost && (
    <>
      <Settings settings={settings} onChange={onSettingsChange} idPrefix="mp-" />
      <div className="board-actions">
        <button className="btn btn-primary" onClick={startGame}>
          {room.status === 'finished' ? 'Play again' : 'Start game'}
        </button>
      </div>
    </>
  );

  const topScore = room.players[0]?.score ?? 0;
  const winners = room.players.filter((p) => p.score === topScore);

  return (
    <>
      <section className="board room-bar" aria-label="Room">
        <div className="board-body">
          <div className="room-id">
            <span className="readout-label">Room code</span>
            <FlapText text={room.code} label={room.code.split('').join(' ')} size="xl" />
          </div>
          <div className="room-actions">
            <button className="btn" onClick={copyInvite}>
              <Icon name="link" />
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
            <button className="btn btn-ghost" onClick={leaveRoom}>
              <Icon name="exit" />
              Leave
            </button>
          </div>
        </div>
      </section>

      {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}

      {room.status === 'lobby' && (
        <section className="board" aria-labelledby="lobby-title">
          <div className="board-head">
            <h2 className="board-title" id="lobby-title">Lobby</h2>
          </div>
          <div className="board-body">
            {isHost ? (
              <>
                <p className="muted-text lobby-note">
                  Share the room code with friends. Pick the settings and start when everyone has joined.
                </p>
                {hostControls}
              </>
            ) : (
              <p className="waiting">Waiting for {host?.name ?? 'the host'} to start the game…</p>
            )}
          </div>
        </section>
      )}

      {room.status === 'loading' && (
        <section className="board board-idle">
          <div className="board-body">
            <FlapText text="LOADING" label="" size="lg" />
            <p role="status">Getting questions…</p>
          </div>
        </section>
      )}

      {room.status === 'finished' && (
        <section className="board" aria-labelledby="results-title">
          <div className="board-head">
            <h2 className="board-title" id="results-title">Final results</h2>
          </div>
          <div className="board-body">
            <p className="winner">
              <Icon name="trophy" size={28} />
              <span>
                {winners.map((w) => w.name).join(' & ')} {winners.length > 1 ? 'tie' : 'wins'} with {topScore} / {room.questionCount}!
              </span>
            </p>
            {isHost ? hostControls : <p className="muted-text">Waiting for {host?.name ?? 'the host'} to start another round…</p>}
          </div>
        </section>
      )}

      {room.status === 'finished' && <Leaderboard room={room} myId={myId} />}

      {room.status === 'playing' && iAmDone && (
        <p className="banner" role="status">
          You're done! Waiting for everyone else to finish…
        </p>
      )}

      {(room.status === 'playing' || room.status === 'finished') && current && (
        <QuestionCard
          index={currentIndex}
          total={total}
          category={current.category}
          question={current.question}
          options={current.options}
          picked={results[currentIndex]?.answer}
          correctAnswer={results[currentIndex]?.correctAnswer}
          score={me?.score ?? 0}
          marks={marks}
          onAnswer={answer}
          onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          onJump={setCurrentIndex}
        />
      )}

      {room.status !== 'finished' && <Leaderboard room={room} myId={myId} />}
    </>
  );
}

// Each player keeps the same line colour for the whole game, picked from their id
function playerLine(id) {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return lines[sum % lines.length];
}

// The players as a departures board: rank, name, progress, score
function Leaderboard({ room, myId }) {
  const showProgress = room.status === 'playing';
  const digits = Math.max(2, String(room.questionCount).length);
  return (
    <section className="board" aria-labelledby="players-title">
      <div className="board-head">
        <h2 className="board-title" id="players-title">Players ({room.players.length})</h2>
        <span className="board-head-cols" aria-hidden="true">
          {showProgress && <span>Answered</span>}
          <span>Score</span>
        </span>
      </div>
      <ol className="leaderboard">
        {room.players.map((player, i) => (
          <li key={player.id} className={player.id === myId ? 'me' : ''}>
            <span className="rank">{i + 1}</span>
            <span className="player-name">
              <span className={`player-line route-${playerLine(player.id)}`} aria-hidden="true" />
              {player.name}
              {player.id === room.hostId && <span className="badge">host</span>}
              {player.id === myId && <span className="badge badge-you">you</span>}
            </span>
            {showProgress && (
              <span className="player-progress">{player.answered}/{room.questionCount}</span>
            )}
            <FlapText
              className="player-score"
              text={String(player.score).padStart(digits, '0')}
              label={`${player.score} points`}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default Multiplayer;
