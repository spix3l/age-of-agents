export type AudioCue = 'select' | 'command' | 'build' | 'shot' | 'destroy' | 'evolve' | 'victory' | 'defeat' | 'alarm';

const FREQUENCY: Readonly<Record<AudioCue, readonly [number, number]>> = {
  select: [520, 0.045], command: [360, 0.07], build: [240, 0.12], shot: [760, 0.04],
  destroy: [110, 0.18], evolve: [440, 0.45], victory: [660, 0.55], defeat: [92, 0.6], alarm: [300, 0.5],
};

/** Tiny procedural sound palette: no asset request can ever block gameplay or replay. */
export class AudioManager {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private readonly abort = new AbortController();
  private active = 0;
  muted = readMuted();
  volume = readVolume();

  constructor(target: HTMLElement) {
    const unlock = () => this.unlock();
    target.addEventListener('pointerdown', unlock, { signal: this.abort.signal, once: true });
    globalThis.addEventListener?.('keydown', unlock, { signal: this.abort.signal, once: true });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.output) this.output.gain.value = muted ? 0 : this.volume * 0.18;
    try { globalThis.localStorage?.setItem('age-of-agents-muted', muted ? '1' : '0'); } catch { /* storage is optional */ }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.output) this.output.gain.value = this.muted ? 0 : this.volume * 0.18;
    try { globalThis.localStorage?.setItem('age-of-agents-volume', String(this.volume)); } catch { /* storage is optional */ }
  }

  play(cue: AudioCue): void {
    if (this.muted || !this.context || !this.output || this.active >= 6) return;
    const [frequency, duration] = FREQUENCY[cue];
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = cue === 'destroy' || cue === 'defeat' || cue === 'alarm' ? 'sawtooth' : cue === 'shot' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    if (cue === 'evolve' || cue === 'victory') oscillator.frequency.exponentialRampToValueAtTime(frequency * 2, this.context.currentTime + duration);
    envelope.gain.setValueAtTime(0.7, this.context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(envelope).connect(this.output);
    this.active += 1;
    oscillator.onended = () => { this.active = Math.max(0, this.active - 1); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(); oscillator.stop(this.context.currentTime + duration);
  }

  dispose(): void {
    this.abort.abort();
    void this.context?.close();
    this.context = null; this.output = null; this.active = 0;
  }

  private unlock(): void {
    if (this.context || typeof AudioContext === 'undefined') return;
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = this.muted ? 0 : this.volume * 0.18;
    this.output.connect(this.context.destination);
  }
}

function readMuted(): boolean {
  try { return globalThis.localStorage?.getItem('age-of-agents-muted') === '1'; } catch { return false; }
}

function readVolume(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem('age-of-agents-volume') ?? 0.66);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.66;
  } catch { return 0.66; }
}
