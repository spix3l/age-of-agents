import { AI_DIFFICULTY, type AIDifficulty } from '../../data/ai';
import { useUiStore } from '../store';

const DIFFICULTIES: readonly AIDifficulty[] = ['relaxed', 'standard', 'relentless'];

const HOW_TO_PLAY: readonly (readonly [string, string])[] = [
  ['GATHER', 'Left-click a Worker, right-click a Matter or Energy deposit. Use AUTO MATTER / AUTO ENERGY to keep it looping forever.'],
  ['BUILD', 'With a Worker selected, place a Relay Node for Agent Capacity and a Fabricator to make Strikers. Right-click a site to add another builder.'],
  ['EVOLVE', 'Harvest violet Data archives, select the Core, and evolve through Awakening, Autonomy, and Singularity. New Generations unlock new Agents and structures.'],
  ['DEFEND', 'Walls shape approaches, Outposts receive distant cargo, and Generation II Zap Turrets automatically engage hostiles.'],
  ['FIGHT', 'Queue Strikers at the Fabricator, then right-click an enemy Agent or structure to attack. Idle Strikers defend themselves.'],
  ['WIN', 'Destroy the enemy Core before it destroys yours.'],
  ['VIEW', 'ZQSD or arrow keys pan, two-finger scroll pans, pinch zooms, F3 opens diagnostics.'],
];

export function MainMenu() {
  const open = useUiStore((state) => state.menuOpen);
  const showHelp = useUiStore((state) => state.helpOpen);
  const difficulty = useUiStore((state) => state.difficulty);
  const setDifficulty = useUiStore((state) => state.setDifficulty);
  const startMatch = useUiStore((state) => state.startMatch);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  if (!open) return null;

  return (
    <div className="main-menu" role="dialog" aria-modal="true" aria-label="Age of Agents main menu">
      <div className="menu-card">
        <span className="menu-eyebrow">AUTONOMOUS MACHINE COLONY</span>
        <h1>AGE OF AGENTS</h1>
        <p className="menu-tagline">Wake a colony of robots, mine a dead world, and out-evolve a rival intelligence.</p>

        <fieldset className="difficulty">
          <legend>OPPONENT</legend>
          {DIFFICULTIES.map((id) => {
            const preset = AI_DIFFICULTY[id];
            return (
              <button
                key={id}
                type="button"
                className={id === difficulty ? 'active' : undefined}
                aria-pressed={id === difficulty}
                onClick={() => setDifficulty(id)}
              >
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </button>
            );
          })}
        </fieldset>

        <div className="menu-actions">
          <button type="button" className="primary" onClick={startMatch}>PLAY</button>
          <button type="button" onClick={() => setHelpOpen(!showHelp)}>{showHelp ? 'HIDE HELP' : 'HOW TO PLAY'}</button>
        </div>

        {showHelp && (
          <dl className="how-to-play">
            {HOW_TO_PLAY.map(([label, body]) => <div key={label}><dt>{label}</dt><dd>{body}</dd></div>)}
          </dl>
        )}
      </div>
    </div>
  );
}
