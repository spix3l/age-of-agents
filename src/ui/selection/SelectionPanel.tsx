import { useUiStore } from '../store';
import { BUILDINGS } from '../../data/buildings';
import { UNITS } from '../../data/units';
import { ModelPortrait } from '../hud/ModelPortrait';

export function SelectionPanel() {
  const selection = useUiStore((state) => state.selection);
  const selectedCount = useUiStore((state) => state.selectedCount);
  const model = [...Object.values(BUILDINGS), ...Object.values(UNITS)].find((item) => item.label === selection.name);
  const hpRatio = selection.hp !== undefined && selection.maxHp ? Math.max(0, Math.min(1, selection.hp / selection.maxHp)) : null;
  return (
    <section className="selection-panel" aria-label="Selection details">
      <span className="unit-icon" aria-hidden="true">{model ? <ModelPortrait kind={model.id} /> : selection.type === 'resource' ? '◆' : '⬡'}</span>
      <div className="selection-copy">
        <small>{selectedCount > 1 ? `${selectedCount} SELECTED` : selection.type.toUpperCase()}</small>
        <strong>{selection.name}</strong>
        <span>{selection.activity}{selection.detail ? ` · ${selection.detail}` : ''}</span>
        {hpRatio !== null && <div className="hp-track" aria-label={`${selection.hp} of ${selection.maxHp} integrity`}><i style={{ width: `${hpRatio * 100}%` }} /></div>}
        {hpRatio !== null && <small className="integrity-label">{selection.hp} / {selection.maxHp} INTEGRITY</small>}
      </div>
    </section>
  );
}
