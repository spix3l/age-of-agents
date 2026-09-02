import { describe, expect, it } from 'vitest';
import { issueGatherCommand } from '../commands/GatherCommand';
import { EconomyLedger } from '../economy/EconomyLedger';
import { EntityRegistry } from '../entities/core/EntityRegistry';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createWorkerEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { MovementSystem } from './MovementSystem';
import { GatheringSystem, WORKER_CARGO_CAPACITY } from './GatheringSystem';

describe('Worker gathering', () => {
  it('deterministically moves, extracts capped cargo, returns, deposits, and repeats', () => {
    const grid = new NavigationGrid(0, 0, 24, 16);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const core = createCore(entityId('player-core-test'), 'player', { x: 3, z: 8 });
    const node = createResourceNode(entityId('matter-node-test'), 'matter', { x: 17, z: 8 }, 30);
    const worker = createWorkerEntity('worker-gather-test', 'player', { x: 7, z: 8 });
    buildings.add(core); resources.add(node);
    const ledger = new EconomyLedger();
    const movement = new MovementSystem(grid);
    const gathering = new GatheringSystem(resources, buildings, () => ledger, grid);
    expect(issueGatherCommand([worker], node, grid).issued).toBe(1);
    expect(worker.gatherOrder?.resourceType).toBe('matter');
    expect(worker.activity).toBe('Gathering Matter');

    for (let tick = 0; tick < 1_200 && ledger.totalCollected('matter') === 0; tick += 1) {
      movement.update([worker], 1 / 30);
      gathering.update([worker], 1 / 30);
    }

    expect(ledger.totalCollected('matter')).toBe(WORKER_CARGO_CAPACITY);
    expect(worker.cargo.amount).toBe(0);
    expect(worker.gatherOrder).not.toBeNull();
    expect(node.remaining).toBe(20);
  });

  it('idles safely when its empty target is depleted', () => {
    const grid = new NavigationGrid(0, 0, 12, 12);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const node = createResourceNode(entityId('small-node'), 'energy', { x: 8, z: 8 }, 1);
    const worker = createWorkerEntity('worker-retarget-test', 'player', { x: 7, z: 8 });
    resources.add(node);
    issueGatherCommand([worker], node, grid);
    node.alive = false; node.remaining = 0;
    new GatheringSystem(resources, buildings, () => new EconomyLedger(), grid).update([worker], 1 / 30);
    expect(worker.activity).toBe('Idle');
    expect(worker.gatherOrder).toBeNull();
  });
});
