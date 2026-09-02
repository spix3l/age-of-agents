import { describe, expect, it } from 'vitest';
import { entityId } from '../../types/ids';
import type { UnitEntity } from '../../types/simulation';
import { EntityRegistry } from './EntityRegistry';

function unit(id: string): UnitEntity {
  return { id: entityId(id), kind: 'worker', team: 'player', alive: true, position: { x: 0, z: 0 }, previousPosition: { x: 0, z: 0 }, hp: 70, maxHp: 70, radius: 0.5, movementSpeed: 4, path: [], pathIndex: 0, destination: null, stuckSeconds: 0, repathCount: 0, selected: false, activity: 'Idle', cargo: { type: null, amount: 0 }, gatherOrder: null, buildOrder: null, automation: null };
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
