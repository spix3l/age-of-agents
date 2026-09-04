import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { GameHud } from '../ui/hud/GameHud';
import { useUiStore } from '../ui/store';

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const matchNonce = useUiStore((state) => state.matchNonce);
  const menuOpen = useUiStore((state) => state.menuOpen);

  useEffect(() => {
    if (!gameRoot.current || menuOpen) return;
    // Difficulty and mode are read once per match, at construction, so a live match never shifts
    // under the player. `pendingSave`, when the player chose CONTINUE, is the world to rebuild.
    const { difficulty, matchSeed, mode, pendingSave } = useUiStore.getState();
    const game = new Game(gameRoot.current, { difficulty, seed: matchSeed, mode, save: pendingSave });
    game.start();
    return () => game.dispose();
  }, [matchNonce, menuOpen]);

  return (
    <main className="game-shell">
      <div className="game-viewport" ref={gameRoot} aria-label="Age of Agents battlefield" />
      <GameHud />
    </main>
  );
}
