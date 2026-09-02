import { SelectionBox } from '../selection/SelectionBox';
import { useUiStore } from '../store';

export function GameHud() {
  const selected = useUiStore((state) => state.selectedCount);
  const total = useUiStore((state) => state.totalUnits);
  const lastOrder = useUiStore((state) => state.lastOrder);

  return (
    <div className="hud" aria-live="polite">
      <header className="hud-top">
        <div className="brand"><span className="brand-mark">A</span><div><strong>AGE OF AGENTS</strong><small>WORLD PROTOCOL // 01</small></div></div>
        <div className="status-chip"><i /> SIMULATION ONLINE</div>
      </header>
      <aside className="objective-panel">
        <span className="eyebrow">FIELD TEST</span>
        <strong>Route the worker swarm</strong>
        <p>Select all 30 agents and move them through the stone ridges.</p>
        <div className="progress-row"><span>ACTIVE AGENTS</span><b>{total} / 30</b></div>
      </aside>
      <footer className="command-bar">
        <div className="unit-readout"><span className="unit-icon">⬡</span><div><small>SELECTION</small><strong>{selected > 0 ? `${selected} WORKER${selected === 1 ? '' : 'S'}` : 'NO AGENTS'}</strong></div></div>
        <div className="order-readout"><small>LAST DIRECTIVE</small><span>{lastOrder}</span></div>
        <div className="controls"><kbd>ZQSD / ↑</kbd><span>MOVE VIEW</span><kbd>2 FINGERS</kbd><span>PAN · PINCH ZOOM</span><kbd>RMB</kbd><span>MOVE UNITS</span></div>
      </footer>
      <SelectionBox />
    </div>
  );
}
