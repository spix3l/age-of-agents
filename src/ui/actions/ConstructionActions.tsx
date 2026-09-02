import { useUiStore } from '../store';

export function ConstructionActions() {
  const cancel = useUiStore((state) => state.cancelConstruction);
  return <section className="construction-actions">
    <strong>CONSTRUCTION ACTIVE</strong><small>Worker assembly in progress</small>
    <button type="button" onClick={cancel}>CANCEL · 75% REFUND</button>
  </section>;
}
