import { describe, expect, it } from 'vitest';
import type { UnitEntity } from '../../types/simulation';
import { createWorkerEntity } from '../../scenarios/economy';
import { EntityRegistry } from './EntityRegistry';

function unit(id: string): UnitEntity {
  return createWorkerEntity(id, 'player', { x: 0, z: 0 });
}

describe('EntityRegistry', () => {
  it('creates, queries, and destroys stable IDs', () => {
    const registry = new EntityRegistry<UnitEntity>();
    const worker = unit('worker-1');
    registry.add(worker);
    expect(registry.get(worker.id)).toBe(worker);
    expect(registry.destroy(worker.id)).toBe(true);
    expect(worker.alive).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('rejects duplicate IDs', () => {
    const registry = new EntityRegistry<UnitEntity>();
    registry.add(unit('worker-1'));
    expect(() => registry.add(unit('worker-1'))).toThrow(/Duplicate/);
  });
});
