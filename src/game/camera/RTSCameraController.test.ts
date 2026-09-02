import { describe, expect, it } from 'vitest';
import { panDirectionForKey } from './RTSCameraController';

describe('AZERTY camera bindings', () => {
  it('uses layout-aware ZQSD labels', () => {
    expect(panDirectionForKey('z')).toBe('up');
    expect(panDirectionForKey('q')).toBe('left');
    expect(panDirectionForKey('s')).toBe('down');
    expect(panDirectionForKey('d')).toBe('right');
  });

  it('supports directional arrows and ignores former QWERTY labels', () => {
    expect(panDirectionForKey('ArrowUp')).toBe('up');
    expect(panDirectionForKey('ArrowLeft')).toBe('left');
    expect(panDirectionForKey('ArrowDown')).toBe('down');
    expect(panDirectionForKey('ArrowRight')).toBe('right');
    expect(panDirectionForKey('w')).toBeNull();
    expect(panDirectionForKey('a')).toBeNull();
  });
});
