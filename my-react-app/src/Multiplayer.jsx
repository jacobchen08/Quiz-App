import { useEffect, useMemo, useRef, useState } from 'react';
import { roomSocketUrl } from './api';
import Settings from './components/Settings';
import QuestionCard from './components/QuestionCard';
import FlapText from './components/FlapText';
import Icon from './components/Icon';
import ShareResult from './components/ShareResult';
import { lines } from './categories';
import { ordinal, shareText } from './results';

// Multiplayer: one player creates a room and shares the code, everyone answers the
// same questions at their own pace, and scores update live for everyone.
// The server (backend/multiplayer.py) checks answers so nobody can peek at them.
//
// Staying in the room: the server gives each player a token when they join, kept for this
// tab in sessionStorage. If the connection drops, or the page reloads, we join again with
// that token and the server puts us back in our seat with our answers and score.

const initialCode = new URLSearchParams(window.location.search).get('room') || '';

const SEAT_KEY = 'quizzr-seat';
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 8000, 8000]; // about half a minute of tries

function loadSeat() {
  try {
    return JSON.parse(sessionStorage.getItem(SEAT_KEY));
  } catch {
    return null;
  }
}

function saveSeat(seat) {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    // private browsing can refuse storage; reconnecting still works until a reload
  }
}

function clearSeat() {
  try {
    sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // nothing to clear
  }
}

// Points can pass a thousand, so the score tiles always leave room for four digits
const POINT_DIGITS = 4;

function Multiplayer({ settings, onSettingsChange, onProgress }) {
  const [name, setName] = useState(() => loadSeat()?.name ?? '');
  const [codeInput, setCodeInput] = useState(initialCode.toUpperCase());
  const [phase, setPhase] = useState('menu'); // menu | connecting | room | reconnecting
  const [error, setError] = useState('');

  const [myId, setMyId] = useState(null);
  const [room, setRoom] = useState(null); // latest "state" message from the server
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState({}); // question index -> { answer, correct, correctAnswer, points, streak }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef(null);
  const seatRef = useRef(null); // { code, token, name } once the server has welcomed us
  const joinRef = useRef(null); // { code, name } for the connection being opened
  const roundRef = useRef(null);
  const resumeRef = useRef(false); // true until a mid-game join has been moved to its next question
  const questionCountRef = useRef(0);
  const retryRef = useRef({ attempt: 0, timer: null });

  // One mark per question for the step row and the answers board
  const marks = useMemo(
    () =>
      questions.map((_, i) => {
        const result = results[i];
        if (!result) return undefined;
        if (result.correctAnswer === undefined) return 'pending';
        return result.correct ? 'correct' : 'wrong';
      }),
    [questions, results]
  );

  const me = room?.players.find((p) => p.id === myId);

  // Report how my round is going, for the boards beside the quiz on wide screens
  const answeredCount = marks.filter((m) => m === 'correct' || m === 'wrong').length;
  const correctCount = marks.filter((m) => m === 'correct').length;
  const myStreak = me?.streak ?? 0;
  const items = useMemo(
    () => questions.map((q, i) => ({ question: q.question, category: q.category, mark: marks[i] })),
    [questions, marks]
  );
  useEffect(() => {
    onProgress?.({
      answered: answeredCount,
      correct: correctCount,
      total: questions.length,
      streak: myStreak,
      index: currentIndex,
      items,
      jump: setCurrentIndex,
    });
  }, [answeredCount, correctCount, questions.length, myStreak, currentIndex, items, onProgress]);

  function resetRoom() {
    setMyId(null);
    setRoom(null);
    setQuestions([]);
    setResults({});
    setCurrentIndex(0);
    roundRef.current = null;
  }

  function stopRetrying() {
    clearTimeout(retryRef.current.timer);
    retryRef.current = { attempt: 0, timer: null };
  }

  // Out of the room for good: back to the menu. `reason` replaces any error on screen;
  // leave it out to keep the message that's already showing.
  function endSession(reason) {
    stopRetrying();
    seatRef.current = null;
    clearSeat();
    resetRoom();
    setPhase('menu');
    if (reason !== undefined) setError(reason);
  }

  function openSocket(code, joinName) {
    joinRef.current = { code, name: joinName };
    const socket = new WebSocket(roomSocketUrl(code));
    socketRef.current = socket;
    let refused = false; // the server said this room can't be joined, so don't retry

    socket.onopen = () => {
      const seat = seatRef.current;
      socket.send(
        JSON.stringify({
          type: 'join',
          name: joinName,
          token: seat && seat.code === code ? seat.token : undefined,
        })
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'welcome':
          stopRetrying();
          seatRef.current = { code, token: message.token, name: joinRef.current.name };
          saveSeat(seatRef.current);
          setMyId(message.playerId);
          setPhase('room');
          setError('');
          break;
        case 'state':
          setRoom(message);
          break;
        case 'questions':
          setQuestions(message.questions);
          questionCountRef.current = message.questions.length;
          // A new game starts from the top; the same game resent after a reconnect keeps your place
          if (message.round !== roundRef.current) {
            resumeRef.current = roundRef.current === null; // joining a game already under way
            roundRef.current = message.round;
            setResults({});
            setCurrentIndex(0);
          }
          break;
        case 'answers': {
          // Our own answers as the server has them, after a reconnect
          setResults(Object.fromEntries(message.results.map((r) => [r.index, r])));
          // After a reload we start from nothing, so carry on at the first question left to answer
          if (resumeRef.current) {
            resumeRef.current = false;
            const done = new Set(message.results.map((r) => r.index));
            const next = Array.from({ length: questionCountRef.current }, (_, i) => i).find((i) => !done.has(i));
            if (next !== undefined) setCurrentIndex(next);
          }
          break;
        }
        case 'answer_result':
          setResults((prev) => ({ ...prev, [message.index]: message }));
          break;
        case 'error':
          if (message.code === 'room_not_found' || message.code === 'room_full') refused = true;
          setError(message.message);
          break;
      }
    };

    socket.onclose = () => {
      if (socketRef.current !== socket) return; // we left on purpose, or a newer socket took over
      socketRef.current = null;
      if (refused) {
        // Rejoining a room that's gone gets a plain explanation; a fresh join keeps the server's message
        endSession(seatRef.current ? 'That room has closed.' : undefined);
        return;
      }
      if (seatRef.current) {
        scheduleReconnect();
      } else {
        endSession('Could not join the room.');
      }
    };
  }

  function scheduleReconnect() {
    const { attempt } = retryRef.current;
    if (attempt >= RETRY_DELAYS.length) {
      endSession('Lost the connection to the room.');
      return;
    }
    setPhase('reconnecting');
    retryRef.current = {
      attempt: attempt + 1,
      timer: setTimeout(() => openSocket(seatRef.current.code, seatRef.current.name), RETRY_DELAYS[attempt]),
    };
  }

  // Back from another app or tab: try straight away instead of waiting out the delay
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (retryRef.current.timer && seatRef.current && !socketRef.current) {
        clearTimeout(retryRef.current.timer);
        retryRef.current.timer = null;
        openSocket(seatRef.current.code, seatRef.current.name);
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A reload in the middle of a game: take our seat back
  useEffect(() => {
    const seat = loadSeat();
    if (seat?.code && seat?.token) {
      seatRef.current = seat;
      setPhase('connecting');
      openSocket(seat.code, seat.name);
    }
    return () => {
      // Leaving the page, or React's development double-mount: close without reconnecting
      const socket = socketRef.current;
      socketRef.current = null;
      clearTimeout(retryRef.current.timer);
      socket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRoom() {
    if (!name.trim()) return setError('Enter your name first.');
    setError('');
    setPhase('connecting');
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();
      seatRef.current = null;
      openSocket(data.code, name.trim());
    } catch {
      setPhase('menu');
      setError('Could not reach the server.');
    }
  }

  function joinRoom() {
    if (!name.trim()) return setError('Enter your name first.');
    const code = codeInput.trim().toUpperCase();
    if (!code) return setError('Enter a room code.');
    setError('');
    setPhase('connecting');
    seatRef.current = null;
    openSocket(code, name.trim());
  }

  function leaveRoom() {
    const socket = socketRef.current;
    socketRef.current = null;
    try {
      socket?.send(JSON.stringify({ type: 'leave' }));
    } catch {
      // already closed; the server will free the seat when its hold runs out
    }
    socket?.close();
    endSession('');
  }

  function send(message) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function startGame() {
    setError('');
    send({ type: 'start', settings });
  }

  function answer(option) {
    // Mark as picked right away so it can't be clicked twice; the server fills in the result.
    // If we're offline, the answer waits here and the server's copy replaces it on reconnect.
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
  const inRoom = (phase === 'room' || phase === 'reconnecting') && room;
  if (!inRoom) {
    const connecting = phase === 'connecting';
    return (
      <section className="board" aria-labelledby="mp-title">
        <div className="board-head">
          <h2 className="board-title" id="mp-title">Play with friends</h2>
        </div>
        <div className="board-body">
          {connecting && seatRef.current && (
            <p className="banner-inline" role="status">Rejoining room {seatRef.current.code}…</p>
          )}
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
  const total = questions.length;
  const iAmDone = total > 0 && answeredCount === total;
  const current = questions[currentIndex];
  const hostControls = isHost && (
    <>
      <Settings settings={settings} onChange={onSettingsChange} idPrefix="mp-" />
      <div className="board-actions">
        <button className="btn btn-primary" onClick={startGame} disabled={phase === 'reconnecting'}>
          {room.status === 'finished' ? 'Play again' : 'Start game'}
        </button>
      </div>
    </>
  );

  const topScore = room.players[0]?.score ?? 0;
  const winners = room.players.filter((p) => p.score === topScore);
  const myRank = room.players.findIndex((p) => p.id === myId) + 1;

  // What the feedback line adds after an answer: the points, any speed bonus, a streak
  const result = results[currentIndex];
  let note;
  if (result?.correctAnswer !== undefined && result.correct && result.points) {
    const bonus = result.points - 100;
    note = `+${result.points} points${bonus > 0 ? `, including a +${bonus} speed bonus` : ''}.`;
    if (result.streak >= 2) note += ` ${result.streak} in a row.`;
  }

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

      {phase === 'reconnecting' && (
        <p className="banner banner-warn" role="status">
          <Icon name="pending" />
          Connection lost. Reconnecting… your seat and score are being held.
        </p>
      )}

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
                  Correct answers score 100 points, plus up to 50 more for answering quickly.
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
                {winners.map((w) => w.name).join(' & ')} {winners.length > 1 ? 'tie' : 'wins'} with {topScore} points!
              </span>
            </p>
            {me && (
              <dl className="results-stats results-stats-compact">
                <div>
                  <dt>You finished</dt>
                  <dd>{ordinal(myRank)} of {room.players.length}</dd>
                </div>
                <div>
                  <dt>Points</dt>
                  <dd>{me.score}</dd>
                </div>
                <div>
                  <dt>Correct</dt>
                  <dd>{me.correct}/{room.questionCount}</dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{me.bestStreak}</dd>
                </div>
              </dl>
            )}
            {me && total > 0 && (
              <ShareResult
                text={shareText({
                  title: `Quizzr · Multiplayer · ${ordinal(myRank)} of ${room.players.length}`,
                  marks,
                  lines: [`${me.score} points · ${me.correct}/${room.questionCount} correct`],
                  url: window.location.origin,
                })}
              />
            )}
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
          difficulty={current.difficulty}
          question={current.question}
          options={current.options}
          picked={results[currentIndex]?.answer}
          correctAnswer={results[currentIndex]?.correctAnswer}
          score={me?.score ?? 0}
          scoreDigits={POINT_DIGITS}
          scoreSuffix="pts"
          scoreLabel={`Score: ${me?.score ?? 0} points`}
          streak={myStreak}
          note={note}
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

// The players as a departures board: rank, name, progress, points
function Leaderboard({ room, myId }) {
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';
  return (
    <section className="board" aria-labelledby="players-title">
      <div className="board-head">
        <h2 className="board-title" id="players-title">Players ({room.players.length})</h2>
        <span className="board-head-cols" aria-hidden="true">
          {playing && <span>Answered</span>}
          {finished && <span>Correct</span>}
          <span>Points</span>
        </span>
      </div>
      <ol className="leaderboard">
        {room.players.map((player, i) => (
          <li key={player.id} className={`${player.id === myId ? 'me' : ''}${player.connected ? '' : ' away'}`}>
            <span className="rank">{i + 1}</span>
            <span className="player-name">
              <span className={`player-line route-${playerLine(player.id)}`} aria-hidden="true" />
              {player.name}
              {player.id === room.hostId && <span className="badge">host</span>}
              {player.id === myId && <span className="badge badge-you">you</span>}
              {!player.connected && <span className="badge badge-away">reconnecting</span>}
              {playing && player.streak >= 2 && (
                <span className="badge badge-streak">
                  <Icon name="bolt" size={12} />
                  {player.streak} in a row
                </span>
              )}
            </span>
            {playing && (
              <span className="player-progress">{player.answered}/{room.questionCount}</span>
            )}
            {finished && (
              <span className="player-progress">{player.correct}/{room.questionCount}</span>
            )}
            <FlapText
              className="player-score"
              text={String(player.score).padStart(POINT_DIGITS, '0')}
              label={`${player.score} points`}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default Multiplayer;
