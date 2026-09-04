import { AI_DIFFICULTY, type AIDifficulty } from '../../data/ai';
import { describeSave, type GameMode } from '../../game/save/SaveGame';
import { useUiStore } from '../store';

const DIFFICULTIES: readonly AIDifficulty[] = ['relaxed', 'standard', 'relentless'];

const MODES: readonly { readonly id: GameMode; readonly label: string; readonly blurb: string }[] = [
  { id: 'campaign', label: 'CAMPAIGN', blurb: 'A rival intelligence is building too. Out-evolve it and break its Core.' },
  { id: 'freestyle', label: 'FREESTYLE', blurb: 'The whole map, no opponent, no clock. Build the colony you want to build.' },
];

const HOW_TO_PLAY: readonly (readonly [string, string])[] = [
  ['GATHER', 'Left-click a Worker, right-click a Matter or Energy deposit. Use AUTO MATTER / AUTO ENERGY to keep it looping forever.'],
  ['BUILD', 'With a Worker selected, place a Relay Node for Agent Capacity and a Fabricator to make Strikers. Right-click a site to add another builder.'],
  ['EVOLVE', 'Harvest violet Data archives, select the Core, and evolve through Awakening, Autonomy, and Singularity. New Generations unlock new Agents and structures.'],
  ['DEFEND', 'Walls shape approaches, Outposts receive distant cargo, and Generation II Zap Turrets automatically engage hostiles.'],
  ['FIGHT', 'Queue Strikers at the Fabricator, then right-click an enemy Agent or structure to attack. Idle Strikers defend themselves.'],
  ['WIN', 'Destroy the enemy Core before it destroys yours — or play Freestyle and just build.'],
  ['VIEW', 'ZQSD or arrow keys pan, two-finger scroll pans, pinch zooms, P pauses, F3 opens diagnostics.'],
];

export function MainMenu() {
  const open = useUiStore((state) => state.menuOpen);
  const showHelp = useUiStore((state) => state.helpOpen);
  const difficulty = useUiStore((state) => state.difficulty);
  const mode = useUiStore((state) => state.mode);
  const savedGame = useUiStore((state) => state.savedGame);
  const setDifficulty = useUiStore((state) => state.setDifficulty);
  const setMode = useUiStore((state) => state.setMode);
  const startMatch = useUiStore((state) => state.startMatch);
  const continueSavedGame = useUiStore((state) => state.continueSavedGame);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  if (!open) return null;

  return (
    <div className="main-menu" role="dialog" aria-modal="true" aria-label="Age of Agents main menu">
      <div className="menu-card">
        <span className="menu-eyebrow">AUTONOMOUS MACHINE COLONY</span>
        <h1>AGE OF AGENTS</h1>
        <p className="menu-tagline">Wake a colony of robots, mine a dead world, and out-evolve a rival intelligence.</p>

        <fieldset className="mode-select">
          <legend>MODE</legend>
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === mode ? 'active' : undefined}
              aria-pressed={entry.id === mode}
              onClick={() => setMode(entry.id)}
            >
              <strong>{entry.label}</strong>
              <small>{entry.blurb}</small>
            </button>
          ))}
        </fieldset>

        {/* The opponent's temperament is a Campaign setting; Freestyle has no opponent to set. */}
        {mode === 'campaign' && (
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
        )}

        <div className="menu-actions">
          <button type="button" className="primary" onClick={() => startMatch(mode)}>PLAY</button>
          {savedGame && (
            <button type="button" className="continue" onClick={continueSavedGame}>
              CONTINUE<small>{describeSave(savedGame)}</small>
            </button>
          )}
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
