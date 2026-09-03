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
    // Difficulty is read once per match, at construction, so a live match never shifts under the player.
    const { difficulty, matchSeed } = useUiStore.getState();
    const game = new Game(gameRoot.current, { difficulty, seed: matchSeed });
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
