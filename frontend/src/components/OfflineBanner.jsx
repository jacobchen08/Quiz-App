import Icon from './Icon';
import useOnline from '../hooks/useOnline';
import { packSize } from '../lib/offlinePack';

// Shown while there's no connection: what still works, and what's waiting for one
function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  const saved = packSize();

  return (
    <section className="board notice offline" role="status" aria-label="You're offline">
      <div className="board-body">
        <Icon name="offline" size={28} />
        <div>
          <p className="notice-title">You're offline</p>
          <p className="notice-text">
            {saved > 0
              ? `Solo still works with ${saved} saved question${saved === 1 ? '' : 's'}. `
              : 'Solo needs saved questions to play offline, and none are saved yet. '}
            The daily challenge and multiplayer come back as soon as you reconnect.
          </p>
        </div>
      </div>
    </section>
  );
}

export default OfflineBanner;
