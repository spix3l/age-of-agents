import { BUILDINGS } from '../../data/buildings';
import type { PlaceableBuildingType } from '../../game/building/PlacementController';
import { useUiStore } from '../store';

const ACTIONS: readonly { readonly type: PlaceableBuildingType; readonly glyph: string }[] = [
  { type: 'relay', glyph: '⌁' },
  { type: 'fabricator', glyph: '▦' },
];

export function WorkerActions() {
  const beginBuild = useUiStore((state) => state.beginBuild);
  const placementMode = useUiStore((state) => state.placementMode);
  return (
    <section className="worker-actions" aria-label="Worker construction">
      {ACTIONS.map(({ type, glyph }) => {
        const config = BUILDINGS[type];
        const active = placementMode === type;
        return <button key={type} type="button" className={`build-button${active ? ' active' : ''}`} onClick={() => beginBuild(type)} aria-pressed={active}>
          <span>{glyph}</span><span><strong>{config.label.toUpperCase()}</strong><small>{config.cost.matter}M · {config.cost.energy}E</small></span>
        </button>;
      })}
      <small className="placement-hint">CLICK TO PLACE · ESC / RMB CANCEL</small>
    </section>
  );
}
