import { UNITS } from '../../data/units';
import { useUiStore } from '../store';

export function CoreActions() {
  const produceWorker = useUiStore((state) => state.produceWorker);
  const queue = useUiStore((state) => state.queue);
  return (
    <section className="core-actions" aria-label="Core production">
      <button type="button" className="produce-button" onClick={produceWorker} aria-label={`Fabricate Worker for ${UNITS.worker.cost.matter} Matter`}>
        <span className="button-glyph">+</span><span><strong>FABRICATE WORKER</strong><small>{UNITS.worker.cost.matter} MATTER · {UNITS.worker.productionTime}s</small></span>
      </button>
      <div className="queue-status">
        <span><small>{queue.label}</small><b>{queue.count > 0 ? `${Math.round(queue.progress * 100)}%` : '—'}</b></span>
        <div className="queue-track"><i style={{ width: `${queue.progress * 100}%` }} /></div>
      </div>
    </section>
  );
}
