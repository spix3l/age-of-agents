import { describe, expect, it } from 'vitest';
import { UNITS } from '../../data/units';
import { Capacity } from '../economy/Capacity';
import { EconomyLedger } from '../economy/EconomyLedger';
import { createCore } from '../entities/buildings/Core';
import { createWorkerEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import { ProductionSystem } from './ProductionSystem';

describe('Core production', () => {
  it('charges on enqueue and spawns in stable simulation-time order', () => {
    const system = new ProductionSystem();
    const core = createCore(entityId('production-core'), 'player', { x: 0, z: 0 });
    const ledger = new EconomyLedger({ matter: 100 });
    const capacity = new Capacity(8, 3);
    expect(system.enqueueWorker(core, ledger, capacity)).toEqual({ ok: true });
    expect(system.enqueueWorker(core, ledger, capacity)).toEqual({ ok: true });
    expect(ledger.balance('matter')).toBe(100 - (UNITS.worker.cost.matter ?? 0) * 2);
    const spawned: string[] = [];
    for (let tick = 0; tick < 362; tick += 1) system.update([core], 1 / 30, () => ({ ledger, capacity }), () => {
      const id = `spawned-${spawned.length + 1}`;
      spawned.push(id);
      return createWorkerEntity(id, 'player', { x: 3, z: 0 });
    });
    expect(spawned).toEqual(['spawned-1', 'spawned-2']);
    expect(capacity.snapshot()).toEqual({ used: 5, reserved: 0, max: 8 });
  });

  it('reports resource/capacity rejection and releases a failed spawn reservation', () => {
    const system = new ProductionSystem();
    const core = createCore(entityId('rejection-core'), 'player', { x: 0, z: 0 });
    const poorLedger = new EconomyLedger({ matter: 0 });
    const capacity = new Capacity(4, 3);
    expect(system.enqueueWorker(core, poorLedger, capacity)).toEqual({ ok: false, reason: 'INSUFFICIENT_RESOURCES' });
    poorLedger.deposit('matter', 45);
    expect(system.enqueueWorker(core, poorLedger, capacity)).toEqual({ ok: true });
    for (let tick = 0; tick < 181; tick += 1) system.update([core], 1 / 30, () => ({ ledger: poorLedger, capacity }), () => null);
    expect(capacity.snapshot().reserved).toBe(0);
    expect(poorLedger.balance('matter')).toBe(45);
    expect(system.enqueueWorker(core, poorLedger, new Capacity(3, 3))).toEqual({ ok: false, reason: 'CAPACITY_REACHED' });
  });
});
