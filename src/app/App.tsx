import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { GameHud } from '../ui/hud/GameHud';

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameRoot.current) return;
    const game = new Game(gameRoot.current);
    game.start();
    return () => game.dispose();
  }, []);

  return (
    <main className="game-shell">
      <div className="game-viewport" ref={gameRoot} aria-label="Age of Agents battlefield" />
      <GameHud />
    </main>
  );
}
