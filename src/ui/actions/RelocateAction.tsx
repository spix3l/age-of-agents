import { useUiStore } from '../store';

/**
 * Picks a finished structure up so it can be set down somewhere else. Nothing is spent and the
 * structure keeps its identity, so this is a layout fix rather than a rebuild.
 */
export function RelocateAction() {
  const beginRelocate = useUiStore((state) => state.beginRelocate);
  const relocating = useUiStore((state) => state.relocating);
  return <section className="relocate-actions">
    <button type="button" className={`relocate-button${relocating ? ' active' : ''}`} onClick={beginRelocate} aria-pressed={relocating}>
      ✥ MOVE BUILDING
    </button>
    <small className="placement-hint">{relocating ? 'CLICK NEW SITE · R ROTATES · ESC / RMB CANCEL' : 'FREE · KEEPS HEALTH AND QUEUE'}</small>
  </section>;
}
