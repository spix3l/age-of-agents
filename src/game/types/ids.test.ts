import { describe, expect, it } from 'vitest';
import { entityId } from './ids';

describe('entityId', () => {
  it('accepts explicit slug IDs', () => expect(entityId('worker-12')).toBe('worker-12'));
  it('rejects display strings', () => expect(() => entityId('Worker Agent')).toThrow(/Invalid/));
});
