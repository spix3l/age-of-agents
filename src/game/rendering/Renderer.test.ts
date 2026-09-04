import { describe, expect, it } from 'vitest';
import { nextQuality, QUALITY_DOWN_SECONDS, QUALITY_UP_SECONDS } from './Renderer';

describe('adaptive render quality', () => {
  it('steps down one tier at a time after sustained trouble, and stops at the floor', () => {
    expect(nextQuality('high', QUALITY_DOWN_SECONDS + 0.1, 0)).toBe('medium');
    expect(nextQuality('medium', QUALITY_DOWN_SECONDS + 0.1, 0)).toBe('low');
    expect(nextQuality('low', 600, 0)).toBeNull();
  });

  it('holds through a brief stutter', () => {
    expect(nextQuality('high', QUALITY_DOWN_SECONDS - 0.1, 0)).toBeNull();
  });

  it('needs far longer to climb back than to drop, so quality cannot oscillate', () => {
    expect(nextQuality('low', 0, QUALITY_DOWN_SECONDS + 0.1)).toBeNull();
    expect(nextQuality('low', 0, QUALITY_UP_SECONDS + 0.1)).toBe('medium');
    expect(nextQuality('medium', 0, QUALITY_UP_SECONDS + 0.1)).toBe('high');
    expect(nextQuality('high', 0, 600)).toBeNull();
  });

  it('treats trouble as the stronger signal when a frame rate is swinging', () => {
    expect(nextQuality('high', QUALITY_DOWN_SECONDS + 0.1, QUALITY_UP_SECONDS + 0.1)).toBe('medium');
  });
});
