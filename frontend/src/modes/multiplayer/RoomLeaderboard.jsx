import { useRef } from 'react';
import FlapText from '../../components/FlapText';
import Icon from '../../components/Icon';
import useFlipList from '../../hooks/useFlipList';
import { lines } from '../../lib/categories';

// Points can pass a thousand, so the score tiles always leave room for four digits
export const POINT_DIGITS = 4;

// Each player keeps the same line colour for the whole game, picked from their id
function playerLine(id) {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return lines[sum % lines.length];
}

// The players in a room as a departures board: rank, name, progress, points
function RoomLeaderboard({ room, myId }) {
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';
  // when someone overtakes someone else, the rows slide past each other
  const listRef = useRef(null);
  useFlipList(listRef, room.players.map((p) => p.id).join(','));
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
      <ol className="leaderboard" ref={listRef}>
        {room.players.map((player, i) => (
          <li key={player.id} data-flip-key={player.id} className={`${player.id === myId ? 'me' : ''}${player.connected ? '' : ' away'}`}>
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

export default RoomLeaderboard;
