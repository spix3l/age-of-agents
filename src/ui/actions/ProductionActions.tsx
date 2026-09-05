import { GENERATIONS } from '../../data/technologies';
import { UNITS } from '../../data/units';
import type { UnitTypeId } from '../../game/types/ids';
import { useUiStore } from '../store';
import { ModelPortrait } from '../hud/ModelPortrait';

export function ProductionActions({ unitTypes, isCore = false }: { readonly unitTypes: readonly UnitTypeId[]; readonly isCore?: boolean }) {
  const queue = useUiStore((state) => state.queue);
  const produceUnit = useUiStore((state) => state.produceUnit);
  const cancelProduction = useUiStore((state) => state.cancelProduction);
  const generation = useUiStore((state) => state.generation);
  const advance = useUiStore((state) => state.advanceGeneration);
  const generationConfig = GENERATIONS[generation];

  return <section className="production-actions" aria-label="Production queue">
    <div className="production-catalog">
      {unitTypes.map((unitType) => {
        const config = UNITS[unitType];
        const cost = config.cost as Readonly<Partial<Record<'matter' | 'energy' | 'data', number>>>;
        return <button key={unitType} type="button" className="produce-button" onClick={() => produceUnit(unitType)}>
          <ModelPortrait kind={unitType} />
          <span><strong>FABRICATE {config.label.toUpperCase()}</strong><small>{cost.matter ?? 0}M · {cost.energy ?? 0}E · {cost.data ?? 0}D</small></span>
        </button>;
      })}
      {isCore && generationConfig.advanceCost && <button type="button" className="evolve-button" onClick={advance}>
        <span>▲</span>
        <span><strong>EVOLVE TO {GENERATIONS[generation === 1 ? 2 : 3].label.toUpperCase()}</strong><small>{generationConfig.advanceCost.matter}M · {generationConfig.advanceCost.energy}E · {generationConfig.advanceCost.data}D</small></span>
      </button>}
      {isCore && !generationConfig.advanceCost && <div className="singularity-badge">SINGULARITY ACHIEVED</div>}
    </div>
    <div className="queue-list">
      <div className="queue-track"><i style={{ width: `${queue.progress * 100}%` }} /></div>
      {queue.items.length === 0 ? <small>QUEUE EMPTY</small> : queue.items.map((item, index) => <button key={item.id} type="button" onClick={() => cancelProduction(item.id)} title="Cancel for full refund">
        <b>{index + 1}</b><span>{item.label}</span><small>{index === 0 ? `${Math.round(queue.progress * 100)}%` : 'WAIT'}</small>
      </button>)}
    </div>
  </section>;
}
