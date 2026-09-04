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
  it('sends a Worker whose deposit runs dry to the next one instead of standing idle', () => {
    const grid = new NavigationGrid(0, 0, 40, 16);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const core = createCore(entityId('player-core-retarget'), 'player', { x: 4, z: 8 });
    // Two rocks: a nearly empty one the Worker is sent to, and a full one beside the colony.
    const spent = createResourceNode(entityId('matter-spent'), 'matter', { x: 16, z: 8 }, 10);
    const spare = createResourceNode(entityId('matter-spare'), 'matter', { x: 12, z: 12 }, 200);
    const worker = createWorkerEntity('worker-retarget', 'player', { x: 8, z: 8 });
    buildings.add(core); resources.add(spent); resources.add(spare);
    const ledger = new EconomyLedger();
    const movement = new MovementSystem(grid);
    const gathering = new GatheringSystem(resources, buildings, () => ledger, grid);
    issueGatherCommand([worker], spent, grid);

    for (let tick = 0; tick < 4_000 && ledger.totalCollected('matter') < 20; tick += 1) {
      movement.update([worker], 1 / 30);
      gathering.update([worker], 1 / 30);
    }

    expect(spent.alive).toBe(false);
    expect(worker.gatherOrder?.resourceId).toBe(spare.id);
    expect(worker.activity).not.toBe('Idle');
    // The point of the retarget: income keeps arriving with no further orders from the player.
    expect(ledger.totalCollected('matter')).toBeGreaterThanOrEqual(20);
  });

  it('leaves a Worker idle when nothing of its resource is left within reach', () => {
    const grid = new NavigationGrid(0, 0, 40, 16);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const core = createCore(entityId('player-core-dry'), 'player', { x: 4, z: 8 });
    const spent = createResourceNode(entityId('matter-only'), 'matter', { x: 16, z: 8 }, 10);
    // A different resource is no substitute: the order was for Matter.
    resources.add(createResourceNode(entityId('energy-elsewhere'), 'energy', { x: 12, z: 12 }, 200));
    const worker = createWorkerEntity('worker-dry', 'player', { x: 8, z: 8 });
    buildings.add(core); resources.add(spent);
    const ledger = new EconomyLedger();
    const movement = new MovementSystem(grid);
    const gathering = new GatheringSystem(resources, buildings, () => ledger, grid);
    issueGatherCommand([worker], spent, grid);

    for (let tick = 0; tick < 4_000 && worker.activity !== 'Idle'; tick += 1) {
      movement.update([worker], 1 / 30);
      gathering.update([worker], 1 / 30);
    }

    expect(worker.activity).toBe('Idle');
    expect(worker.gatherOrder).toBeNull();
    expect(ledger.totalCollected('matter')).toBe(10);
  });

  it('leaves an automated Worker to its own search rather than picking a node for it', () => {
    const grid = new NavigationGrid(0, 0, 40, 16);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const core = createCore(entityId('player-core-auto'), 'player', { x: 4, z: 8 });
    const spent = createResourceNode(entityId('matter-auto-spent'), 'matter', { x: 16, z: 8 }, 10);
    const spare = createResourceNode(entityId('matter-auto-spare'), 'matter', { x: 12, z: 12 }, 200);
    const worker = createWorkerEntity('worker-auto', 'player', { x: 8, z: 8 });
    worker.automation = { resourceType: 'matter', searchCooldown: 0 };
    buildings.add(core); resources.add(spent); resources.add(spare);
    const ledger = new EconomyLedger();
    const movement = new MovementSystem(grid);
    const gathering = new GatheringSystem(resources, buildings, () => ledger, grid);
    issueGatherCommand([worker], spent, grid);

    // Run past the depletion and the last haul home: with no AutomationSystem in this fixture,
    // an automated Worker must end up order-less, waiting for its own search, not re-aimed here.
    for (let tick = 0; tick < 4_000 && worker.gatherOrder !== null; tick += 1) {
      movement.update([worker], 1 / 30);
      gathering.update([worker], 1 / 30);
    }
    expect(spent.alive).toBe(false);
    expect(worker.gatherOrder).toBeNull();
    expect(spare.remaining).toBe(spare.capacity);
  });

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
