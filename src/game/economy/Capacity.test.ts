import { describe, expect, it } from 'vitest';
import { Capacity } from './Capacity';

describe('Agent Capacity', () => {
  it('reserves, commits, cancels, and releases capacity', () => {
    const capacity = new Capacity(5, 3);
    expect(capacity.reserve(2)).toBe(true);
    expect(capacity.reserve(1)).toBe(false);
    capacity.cancel(1);
    capacity.commit(1);
    capacity.releaseUsed(2);
    expect(capacity.snapshot()).toEqual({ used: 2, reserved: 0, max: 5 });
  });

  it('allows providers to disappear without deleting over-cap units', () => {
    const capacity = new Capacity(8, 7);
    capacity.removeProvider(5);
    expect(capacity.snapshot()).toEqual({ used: 7, reserved: 0, max: 3 });
    expect(capacity.reserve(1)).toBe(false);
    capacity.addProvider(5);
    expect(capacity.reserve(1)).toBe(true);
  });
});
