import { describe, expect, it } from 'vitest';
import { containsScreenPoint } from './SelectionSystem';

describe('selection math', () => {
  it('includes borders and excludes outside points', () => {
    const rect = { left: 10, top: 20, right: 100, bottom: 80 };
    expect(containsScreenPoint(rect, { x: 10, y: 80 })).toBe(true);
    expect(containsScreenPoint(rect, { x: 101, y: 50 })).toBe(false);
  });
});
