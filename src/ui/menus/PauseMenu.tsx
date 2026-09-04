import { useEffect } from 'react';
import { useUiStore } from '../store';

/**
 * The held match.
 *
 * `P` toggles the hold from anywhere, and `Esc` lifts it — `Esc` is never allowed to *start* a
 * pause, because in the battlefield it already means "cancel what I am placing". The overlay is
 * where saving lives: it is the one moment the player is definitely not mid-order.
 */
export function PauseMenu() {
  const paused = useUiStore((state) => state.paused);
  const menuOpen = useUiStore((state) => state.menuOpen);
  const matchResult = useUiStore((state) => state.matchResult);
  const mode = useUiStore((state) => state.mode);
  const saveNote = useUiStore((state) => state.saveNote);
  const togglePause = useUiStore((state) => state.togglePause);
  const setPaused = useUiStore((state) => state.setPaused);
  const saveGame = useUiStore((state) => state.saveGame);
  const returnToMenu = useUiStore((state) => state.returnToMenu);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); return; }
      if (event.key === 'Escape' && useUiStore.getState().paused) { event.preventDefault(); setPaused(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause, setPaused]);

  if (!paused || menuOpen || matchResult) return null;

  return (
    <div className="pause-screen" role="dialog" aria-modal="true" aria-label="Match paused">
      <div className="pause-card">
        <small>{mode === 'freestyle' ? 'FREESTYLE' : 'CAMPAIGN'}</small>
        <h1>PAUSED</h1>
        <p className="pause-hint">The colony is holding. Nothing advances until you resume.</p>
        <div className="pause-actions">
          <button type="button" className="primary" onClick={() => setPaused(false)}>RESUME</button>
          <button type="button" onClick={saveGame}>SAVE GAME</button>
          <button type="button" onClick={returnToMenu}>MAIN MENU</button>
        </div>
        {saveNote && <span className="pause-note" role="status">{saveNote}</span>}
        <span className="pause-keys"><kbd>P</kbd> pause · <kbd>Esc</kbd> resume</span>
      </div>
    </div>
  );
}
