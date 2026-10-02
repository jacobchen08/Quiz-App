import { useRef } from 'react';
import useFlipList from '../../hooks/useFlipList';
import { formatSeconds } from '../../lib/results';

const entryKey = (entry) => `${entry.name}|${entry.correct}|${entry.seconds}`;

// Today's finishers, best first: rank, name, correct answers, time.
// `board` is the server's leaderboard ({ entries, finishers }), or null while it loads.
function DailyLeaderboard({ board, total }) {
  // a new finisher slots in and the rows below slide down to make room
  const listRef = useRef(null);
  useFlipList(listRef, board ? board.entries.map(entryKey).join(',') : '');
  if (!board) return null;
  return (
    <section className="board" aria-labelledby="daily-board-title">
      <div className="board-head">
        <h2 className="board-title" id="daily-board-title">Today's leaderboard</h2>
        <span className="board-head-cols" aria-hidden="true">
          <span>Correct</span>
          <span>Time</span>
        </span>
      </div>
      {board.entries.length === 0 ? (
        <p className="log-empty">Nobody has finished today's challenge yet. You could be first.</p>
      ) : (
        <ol className="leaderboard daily-board" ref={listRef}>
          {board.entries.map((entry) => (
            <li key={entryKey(entry)} data-flip-key={entryKey(entry)} className={entry.you ? 'me' : ''}>
              <span className="rank">{entry.rank}</span>
              <span className="player-name">
                {entry.name}
                {entry.you && <span className="badge badge-you">you</span>}
              </span>
              <span className="player-progress">{entry.correct}/{total}</span>
              <span className="player-time">{formatSeconds(entry.seconds)}</span>
            </li>
          ))}
        </ol>
      )}
      {board.finishers > board.entries.length && (
        <p className="board-foot">{board.finishers} players have finished today.</p>
      )}
    </section>
  );
}

export default DailyLeaderboard;
