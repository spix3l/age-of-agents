import { useUiStore } from '../store';

export function SelectionPanel() {
  const selection = useUiStore((state) => state.selection);
  const selectedCount = useUiStore((state) => state.selectedCount);
  const hpRatio = selection.hp !== undefined && selection.maxHp ? Math.max(0, Math.min(1, selection.hp / selection.maxHp)) : null;
  return (
    <section className="selection-panel" aria-label="Selection details">
      <span className="unit-icon" aria-hidden="true">{selection.type === 'resource' ? '◆' : selection.type === 'building' ? '◈' : '⬡'}</span>
      <div className="selection-copy">
        <small>{selectedCount > 1 ? `${selectedCount} SELECTED` : selection.type.toUpperCase()}</small>
        <strong>{selection.name}</strong>
        <span>{selection.activity}{selection.detail ? ` · ${selection.detail}` : ''}</span>
        {hpRatio !== null && <div className="hp-track" aria-label={`${selection.hp} of ${selection.maxHp} integrity`}><i style={{ width: `${hpRatio * 100}%` }} /></div>}
      </div>
    </section>
  );
}
