import { UNITS } from '../../data/units';
import { ProductionActions } from '../actions/ProductionActions';
import { ConstructionActions } from '../actions/ConstructionActions';
import { RelocateAction } from '../actions/RelocateAction';
import { SynthesisActions } from '../actions/SynthesisActions';
import { SelectionPanel } from '../selection/SelectionPanel';
import { SelectionBox } from '../selection/SelectionBox';
import { useUiStore } from '../store';
import { WorkerActions } from '../actions/WorkerActions';
import { EndScreen } from '../menus/EndScreen';
import { MainMenu } from '../menus/MainMenu';
import { PauseMenu } from '../menus/PauseMenu';
import { DebugPanel } from '../debug/DebugPanel';
import { Minimap } from './Minimap';
import { GENERATIONS } from '../../data/technologies';

/** One resource readout: stock, and what the colony is actually earning per second. */
function Resource({ kind, glyph, label, amount, rate }: {
  readonly kind: string; readonly glyph: string; readonly label: string;
  readonly amount: number; readonly rate: number;
}) {
  return (
    <div className={`resource ${kind}`}>
      <span className="resource-glyph">{glyph}</span>
      <div className="resource-body">
        <small>{label}</small>
        <strong>{Math.floor(amount)}</strong>
      </div>
      {rate > 0.05 && <span className="resource-rate">+{rate.toFixed(1)}/s</span>}
    </div>
  );
}

export function GameHud() {
  const matter = useUiStore((state) => state.matter);
  const energy = useUiStore((state) => state.energy);
  const data = useUiStore((state) => state.data);
  const generation = useUiStore((state) => state.generation);
  const used = useUiStore((state) => state.capacityUsed);
  const reserved = useUiStore((state) => state.capacityReserved);
  const max = useUiStore((state) => state.capacityMax);
  const selection = useUiStore((state) => state.selection);
  const lastOrder = useUiStore((state) => state.lastOrder);
  const audioMuted = useUiStore((state) => state.audioMuted);
  const toggleAudio = useUiStore((state) => state.toggleAudio);
  const income = useUiStore((state) => state.income);
  const alert = useUiStore((state) => state.alert);
  const audioVolume = useUiStore((state) => state.audioVolume);
  const setAudioVolume = useUiStore((state) => state.setAudioVolume);
  const mode = useUiStore((state) => state.mode);
  const paused = useUiStore((state) => state.paused);
  const togglePause = useUiStore((state) => state.togglePause);

  return (
    <div className="hud" aria-live="polite">
      <header className="hud-top">
        <div className="brand"><span className="brand-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 44 39H4Z M24 15 35 34H13Z M24 4V0 M4 39 0 46 M44 39 48 46"/><circle cx="24" cy="26" r="5"/></svg></span><div><strong>AGE OF AGENTS</strong><small>GENERATION {generation} · {GENERATIONS[generation].label.toUpperCase()}</small></div></div>
        <div className="resource-bar" aria-label="Player economy">
          <Resource kind="matter" glyph="◆" label="MATTER" amount={matter} rate={income.matter} />
          <Resource kind="energy" glyph="ϟ" label="ENERGY" amount={energy} rate={income.energy} />
          <Resource kind="data" glyph="✦" label="DATA" amount={data} rate={income.data} />
          <div className="resource agents"><span className="resource-glyph">⬡</span><div className="resource-body"><small>AGENTS</small><strong>{used}{reserved > 0 ? `+${reserved}` : ''} / {max}</strong></div></div>
        </div>
        <div className="hud-status"><button type="button" className="pause-toggle" onClick={togglePause} aria-pressed={paused} title="Pause (P)">⏸</button><button type="button" className="audio-toggle" onClick={toggleAudio} aria-pressed={audioMuted} title={audioMuted ? 'Sound off' : 'Sound on'}>{audioMuted ? '🔇' : '🔊'}</button><input className="volume-slider" aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value={audioVolume} onChange={(event) => setAudioVolume(Number(event.target.value))} /></div>
      </header>

      <aside className="objective-panel">
        <details>
        <summary><span className="eyebrow">COLONY DIRECTIVE</span><strong>{mode === 'freestyle' ? 'Grow the colony, evolve the technology' : 'Destroy the enemy Core'}</strong></summary>
        <p>{mode === 'freestyle' ? 'Gather resources, expand your settlement, and unlock the next generation.' : 'A rival intelligence is building its own colony. Expand, mass Strikers, and strike first.'}</p>
        <div className="cost-row"><span>WORKER COST</span><b>◆ {UNITS.worker.cost.matter} MATTER</b></div>
        </details>
      </aside>

      {alert && <div key={alert.nonce} className="combat-alert" role="alert">
        <span className="alert-mark" aria-hidden="true">⚠</span>
        <div><strong>{alert.text}</strong><small>PRESS SPACE TO LOOK</small></div>
      </div>}

      {generation > 1 && <div key={generation} className="generation-banner" role="status">
        <small>COGNITION BLOOM COMPLETE</small><strong>GENERATION {generation}</strong><span>{GENERATIONS[generation].label}</span>
      </div>}

      <Minimap />

      <footer className="command-deck">
        <SelectionPanel />
        <div className="order-readout"><small>LAST DIRECTIVE</small><span>{lastOrder}</span></div>
        <div className="deck-actions">
          {selection.synthesis && <SynthesisActions plant={selection.synthesis} />}
          {selection.canRelocate && <RelocateAction />}
          {selection.constructionSite ? <ConstructionActions /> : selection.producer ? <ProductionActions unitTypes={selection.producer} isCore={selection.isPlayerCore} /> : selection.canRelocate ? null : <div className="controls"><span><kbd>RMB</kbd> MOVE · GATHER · ATTACK</span><span><kbd>ZQSD</kbd> PAN</span><span><kbd>PINCH</kbd> ZOOM</span></div>}
        </div>
      </footer>
      <aside className="construction-deck" aria-label="Construction catalog">
        <details className="construction-drawer">
          <summary>Construction <span>{selection.canBuild ? 'Worker ready' : 'Select a Worker to build'}</span></summary>
          <WorkerActions enabled={selection.canBuild} />
        </details>
      </aside>
      <SelectionBox />
      <DebugPanel />
      <EndScreen />
      <PauseMenu />
      <MainMenu />
    </div>
  );
}
