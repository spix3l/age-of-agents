import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { GameHud } from '../ui/hud/GameHud';
import { useUiStore } from '../ui/store';

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const matchNonce = useUiStore((state) => state.matchNonce);

  useEffect(() => {
    if (!gameRoot.current) return;
    const game = new Game(gameRoot.current);
    game.start();
    return () => game.dispose();
  }, [matchNonce]);

  return (
    <main className="game-shell">
      <div className="game-viewport" ref={gameRoot} aria-label="Age of Agents battlefield" />
      <GameHud />
    </main>
  );
}
