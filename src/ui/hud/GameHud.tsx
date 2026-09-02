import { UNITS } from '../../data/units';
import { ProductionActions } from '../actions/ProductionActions';
import { ConstructionActions } from '../actions/ConstructionActions';
import { SelectionPanel } from '../selection/SelectionPanel';
import { SelectionBox } from '../selection/SelectionBox';
import { useUiStore } from '../store';
import { WorkerActions } from '../actions/WorkerActions';

export function GameHud() {
  const matter = useUiStore((state) => state.matter);
  const energy = useUiStore((state) => state.energy);
  const used = useUiStore((state) => state.capacityUsed);
  const reserved = useUiStore((state) => state.capacityReserved);
  const max = useUiStore((state) => state.capacityMax);
  const selection = useUiStore((state) => state.selection);
  const lastOrder = useUiStore((state) => state.lastOrder);

  return (
    <div className="hud" aria-live="polite">
      <header className="hud-top">
        <div className="brand"><span className="brand-mark">A</span><div><strong>AGE OF AGENTS</strong><small>COLONY PROTOCOL // 03</small></div></div>
        <div className="resource-bar" aria-label="Player economy">
          <div className="resource matter"><span className="resource-glyph">◆</span><small>MATTER</small><strong>{Math.floor(matter)}</strong></div>
          <div className="resource energy"><span className="resource-glyph">ϟ</span><small>ENERGY</small><strong>{Math.floor(energy)}</strong></div>
          <div className="resource agents"><span className="resource-glyph">⬡</span><small>AGENTS</small><strong>{used}{reserved > 0 ? `+${reserved}` : ''} / {max}</strong></div>
        </div>
        <div className="status-chip"><i /> ECONOMY ONLINE</div>
      </header>

      <aside className="objective-panel">
        <span className="eyebrow">COLONY DIRECTIVE</span>
        <strong>Establish infrastructure</strong>
        <p>Gather reserves, then select Workers to place Relay Nodes and Fabricators.</p>
        <div className="cost-row"><span>WORKER COST</span><b>{UNITS.worker.cost.matter} MATTER</b></div>
      </aside>

      <footer className="command-deck">
        <SelectionPanel />
        <div className="order-readout"><small>LAST DIRECTIVE</small><span>{lastOrder}</span></div>
        {selection.constructionSite ? <ConstructionActions /> : selection.producer ? <ProductionActions unitType={selection.producer} /> : selection.canBuild ? <WorkerActions /> : <div className="controls"><kbd>ZQSD / ↑↓←→</kbd><span>MOVE VIEW</span><kbd>2 FINGERS</kbd><span>PAN · PINCH ZOOM</span><kbd>RMB</kbd><span>MOVE / GATHER</span></div>}
      </footer>
      <SelectionBox />
    </div>
  );
}
