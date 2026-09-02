import { useUiStore, type DebugSnapshot } from '../store';

const ROWS: readonly (readonly [string, (debug: DebugSnapshot) => string])[] = [
  ['FPS', (debug) => String(debug.fps)],
  ['ENTITIES', (debug) => `${debug.units}u ${debug.buildings}b`],
  ['SIM TIME', (debug) => `${Math.floor(debug.elapsedSeconds / 60)}m ${Math.floor(debug.elapsedSeconds % 60)}s`],
  ['AI STATE', (debug) => debug.aiState],
  ['AI GOAL', (debug) => debug.aiReason],
  ['AI ECONOMY', (debug) => `${debug.aiMatter}M ${debug.aiEnergy}E · ${debug.aiCapacity}`],
  ['AI FORCES', (debug) => `${debug.aiWorkers} workers · ${debug.aiArmy} army · ${debug.aiAssault} attacking`],
  ['AI INTEL', (debug) => (debug.aiCoreKnown ? 'player core known' : 'scouting')],
  ['EFFECTS', (debug) => `${debug.effectsActive} active · ${debug.effectsPooled} pooled`],
];

export function DebugPanel() {
  const visible = useUiStore((state) => state.debugVisible);
  const debug = useUiStore((state) => state.debug);
  if (!visible) return null;
  return (
    <section className="debug-panel" aria-label="Debug overlay">
      <header>DIAGNOSTICS <small>F3</small></header>
      <dl>
        {ROWS.map(([label, read]) => <div key={label}><dt>{label}</dt><dd>{read(debug)}</dd></div>)}
      </dl>
    </section>
  );
}
