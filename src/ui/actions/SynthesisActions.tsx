import { useUiStore, type SelectionSnapshot } from '../store';

const STATUS_COPY = {
  running: 'CONVERTING',
  starved: 'WAITING ON INPUT',
  paused: 'OFFLINE',
  offline: 'OFFLINE',
} as const;

/**
 * A synthesis plant's switch. A plant burns its input whether or not the colony wanted it spent
 * this minute, so the player must be able to stop it without demolishing it.
 */
export function SynthesisActions({ plant }: { readonly plant: NonNullable<SelectionSnapshot['synthesis']> }) {
  const toggleSynthesis = useUiStore((state) => state.toggleSynthesis);
  const synthesis = plant;
  const paused = synthesis.status === 'paused';
  return <section className="synthesis-actions" aria-label="Synthesis plant">
    <button type="button" className={`synthesis-button${paused ? ' active' : ''}`} onClick={toggleSynthesis} aria-pressed={paused}>
      {paused ? '▶ BRING ONLINE' : '⏹ TAKE OFFLINE'}
    </button>
    <div className="synthesis-status">
      <span><small>{STATUS_COPY[synthesis.status]}</small><b>{synthesis.recipe}</b></span>
      <div className="queue-track"><i style={{ width: `${(paused ? 0 : synthesis.progress) * 100}%` }} /></div>
    </div>
  </section>;
}
