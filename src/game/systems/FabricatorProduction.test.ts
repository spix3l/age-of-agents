import { describe, expect, it } from 'vitest';
import { Capacity } from '../economy/Capacity';
import { EconomyLedger } from '../economy/EconomyLedger';
import { createBuildingSite } from '../entities/buildings/Building';
import { createUnitEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import { ProductionSystem } from './ProductionSystem';

describe('Fabricator production', () => {
  it('queues multiple Strikers, enforces cost/capacity, and spawns them in order', () => {
    const system = new ProductionSystem();
    const fabricator = createBuildingSite(entityId('operational-fabricator'), 'fabricator', 'player', { x: 8, z: 8 }, entityId('builder'));
    fabricator.operational = true; fabricator.constructionProgress = 1;
    const ledger = new EconomyLedger({ matter: 120, energy: 40 });
    const capacity = new Capacity(8, 3);
    expect(system.enqueue(fabricator, 'striker', ledger, capacity)).toEqual({ ok: true });
    expect(system.enqueue(fabricator, 'striker', ledger, capacity)).toEqual({ ok: true });
    expect(ledger.snapshot()).toMatchObject({ matter: 0, energy: 0 });
    const spawned: string[] = [];
    for (let tick = 0; tick < 500; tick += 1) system.update([fabricator], 1 / 30, () => ({ ledger, capacity }), (_producer, unitType) => {
      const id = `striker-spawn-${spawned.length + 1}`;
      spawned.push(id);
      return createUnitEntity(id, unitType, 'player', { x: 11, z: 8 });
    });
    expect(spawned).toEqual(['striker-spawn-1', 'striker-spawn-2']);
    expect(capacity.snapshot()).toEqual({ used: 5, reserved: 0, max: 8 });
  });

  it('cancels a selected queue item with a full refund and releases its reservation', () => {
    const system = new ProductionSystem();
    const fabricator = createBuildingSite(entityId('cancel-fabricator'), 'fabricator', 'player', { x: 8, z: 8 }, entityId('cancel-builder'));
    fabricator.operational = true;
    const ledger = new EconomyLedger({ matter: 60, energy: 20 });
    const capacity = new Capacity(8, 3);
    system.enqueue(fabricator, 'striker', ledger, capacity);
    expect(system.cancelOrder(fabricator, fabricator.productionQueue[0]!.id, ledger, capacity)).toBe(true);
    expect(ledger.snapshot()).toMatchObject({ matter: 60, energy: 20 });
    expect(capacity.snapshot().reserved).toBe(0);
  });

  it('resolves every reservation when a producer is destroyed', () => {
    const system = new ProductionSystem();
    const fabricator = createBuildingSite(entityId('destroyed-fabricator'), 'fabricator', 'player', { x: 8, z: 8 }, entityId('destroy-builder'));
    fabricator.operational = true;
    const ledger = new EconomyLedger({ matter: 120, energy: 40 });
    const capacity = new Capacity(8, 3);
    system.enqueue(fabricator, 'striker', ledger, capacity);
    system.enqueue(fabricator, 'striker', ledger, capacity);
    fabricator.alive = false;
    expect(system.cancelAll(fabricator, ledger, capacity)).toBe(2);
    expect(capacity.snapshot().reserved).toBe(0);
    expect(ledger.snapshot()).toMatchObject({ matter: 120, energy: 40 });
  });
});
