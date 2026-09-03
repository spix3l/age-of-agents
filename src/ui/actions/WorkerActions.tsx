import { BUILDINGS } from '../../data/buildings';
import { BUILDING_GENERATION } from '../../data/technologies';
import type { PlaceableBuildingType } from '../../game/building/PlacementController';
import { useUiStore } from '../store';

const ACTIONS: readonly { readonly type: PlaceableBuildingType; readonly glyph: string }[] = [
  { type: 'relay', glyph: '⌁' },
  { type: 'fabricator', glyph: '▦' },
  { type: 'habitat', glyph: '⌂' },
  { type: 'depot', glyph: '▤' },
  { type: 'wall', glyph: '▰' },
  { type: 'gate', glyph: '∏' },
  { type: 'outpost', glyph: '⌖' },
  { type: 'turret', glyph: '⏂' },
  { type: 'foundry', glyph: '⬢' },
];

export function WorkerActions() {
  const beginBuild = useUiStore((state) => state.beginBuild);
  const placementMode = useUiStore((state) => state.placementMode);
  const automate = useUiStore((state) => state.automate);
  const generation = useUiStore((state) => state.generation);
  return (
    <section className="worker-actions" aria-label="Worker construction">
      {ACTIONS.filter(({ type }) => generation >= BUILDING_GENERATION[type]).map(({ type, glyph }) => {
        const config = BUILDINGS[type];
        const cost = config.cost as Readonly<Partial<Record<'matter' | 'energy' | 'data', number>>>;
        const active = placementMode === type;
        return <button key={type} type="button" className={`build-button${active ? ' active' : ''}`} onClick={() => beginBuild(type)} aria-pressed={active}>
          <span>{glyph}</span><span><strong>{config.label.toUpperCase()}</strong><small>{cost.matter ?? 0}M · {cost.energy ?? 0}E · {cost.data ?? 0}D</small></span>
        </button>;
      })}
      <button type="button" className="automation-button matter" onClick={() => automate('matter')}>AUTO · MATTER</button>
      <button type="button" className="automation-button energy" onClick={() => automate('energy')}>AUTO · ENERGY</button>
      <button type="button" className="automation-button data" onClick={() => automate('data')}>AUTO · DATA</button>
      <small className="placement-hint">CLICK OR DRAG TO PLACE · R ROTATES · ESC / RMB CANCEL</small>
    </section>
  );
}
