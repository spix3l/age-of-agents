import { UNITS } from '../../data/units';
import { useUiStore } from '../store';

export function ProductionActions({ unitType }: { readonly unitType: 'worker' | 'striker' }) {
  const queue = useUiStore((state) => state.queue);
  const produceUnit = useUiStore((state) => state.produceUnit);
  const cancelProduction = useUiStore((state) => state.cancelProduction);
  const config = UNITS[unitType];
  return <section className="production-actions" aria-label="Production queue">
    <button type="button" className="produce-button" onClick={() => produceUnit(unitType)}>
      <span className="button-glyph">+</span><span><strong>FABRICATE {config.label.toUpperCase()}</strong><small>{config.cost.matter ?? 0}M · {'energy' in config.cost ? config.cost.energy : 0}E · {config.productionTime}s</small></span>
    </button>
    <div className="queue-list">
      <div className="queue-track"><i style={{ width: `${queue.progress * 100}%` }} /></div>
      {queue.items.length === 0 ? <small>QUEUE EMPTY</small> : queue.items.map((item, index) => <button key={item.id} type="button" onClick={() => cancelProduction(item.id)} title="Cancel for full refund">
        <b>{index + 1}</b><span>{item.label}</span><small>{index === 0 ? `${Math.round(queue.progress * 100)}%` : 'WAIT'}</small>
      </button>)}
    </div>
  </section>;
}
