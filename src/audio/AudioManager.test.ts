import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from './AudioManager';

afterEach(() => vi.unstubAllGlobals());

describe('AudioManager fallbacks', () => {
  it('persists settings and remains safe when Web Audio is unavailable', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('AudioContext', undefined);
    const target = new EventTarget() as HTMLElement;
    const audio = new AudioManager(target);

    audio.setMuted(true);
    audio.setVolume(0.4);
    expect(values.get('age-of-agents-muted')).toBe('1');
    expect(values.get('age-of-agents-volume')).toBe('0.4');
    expect(() => {
      target.dispatchEvent(new Event('pointerdown'));
      audio.play('command');
      audio.dispose();
    }).not.toThrow();
  });
});
