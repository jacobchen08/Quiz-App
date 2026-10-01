import Icon from '../../components/Icon';

const CODE_LENGTH = 5;
const BLANK = '\u00a0'; // a non-breaking space keeps an empty tile from collapsing

// The way into multiplayer: your name, then either a new room or a code to join one.
// `rejoining` is the code of a room this tab is reconnecting to after a reload, if any.
function JoinRoom({ name, onNameChange, code, onCodeChange, connecting, rejoining, online, error, onCreate, onJoin }) {
  const codeComplete = code.trim().length === CODE_LENGTH;
  return (
    <section className="board" aria-labelledby="mp-title">
      <div className="board-head">
        <h2 className="board-title" id="mp-title">Play with friends</h2>
      </div>
      <div className="board-body">
        {connecting && rejoining && (
          <p className="banner-inline" role="status">Rejoining room {rejoining}…</p>
        )}
        <div className="field name-field">
          <label htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            type="text"
            maxLength={20}
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div className="join-grid">
          <div className="join-option">
            <h3 className="join-heading">Start a new room</h3>
            <p className="muted-text">You'll be the host and pick the quiz settings.</p>
            {/* one yellow key at a time: Join takes over once a whole code is typed */}
            <button className={codeComplete ? 'btn' : 'btn btn-primary'} onClick={onCreate} disabled={connecting || !online}>
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
                maxLength={CODE_LENGTH}
                autoComplete="off"
                spellCheck="false"
                aria-label="Room code"
                aria-describedby="code-caption"
                value={code}
                onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              />
              <span className="code-tiles" aria-hidden="true">
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <span key={i} className={`flap${i === Math.min(code.length, CODE_LENGTH - 1) ? ' is-next' : ''}`}>
                    <span className="flap-char">{code[i] || BLANK}</span>
                  </span>
                ))}
              </span>
            </div>
            <p className="code-caption" id="code-caption">The 5-letter room code from the host</p>
            <button className={codeComplete ? 'btn btn-primary' : 'btn'} onClick={onJoin} disabled={connecting || !online}>
              {connecting ? 'Connecting…' : 'Join room'}
            </button>
          </div>
        </div>

        {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}
      </div>
    </section>
  );
}

export default JoinRoom;
