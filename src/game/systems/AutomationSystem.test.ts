import { describe, expect, it } from 'vitest';
import { automateWorkers } from '../commands/AutomateCommand';
import { EconomyLedger } from '../economy/EconomyLedger';
import { createCore } from '../entities/buildings/Core';
import { EntityRegistry } from '../entities/core/EntityRegistry';
import { createResourceNode, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createWorkerEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { MovementSystem } from './MovementSystem';
import { GatheringSystem } from './GatheringSystem';
import { AutomationSystem } from './AutomationSystem';

describe('persistent economy automation', () => {
  it('depletes one matching node, retargets another, and keeps the automation mode', () => {
    const grid = new NavigationGrid(0, 0, 30, 20);
    const resources = new EntityRegistry<ResourceNodeEntity>();
    const buildings = new EntityRegistry<BuildingEntity>();
    const worker = createWorkerEntity('automation-worker', 'player', { x: 7, z: 10 });
    buildings.add(createCore(entityId('automation-core'), 'player', { x: 3, z: 10 }));
    resources.add(createResourceNode(entityId('matter-a'), 'matter', { x: 13, z: 8 }, 10));
    resources.add(createResourceNode(entityId('matter-b'), 'matter', { x: 17, z: 12 }, 10));
    const ledger = new EconomyLedger();
    const movement = new MovementSystem(grid);
    const gathering = new GatheringSystem(resources, buildings, () => ledger, grid);
    const automation = new AutomationSystem(resources, grid);
    expect(automateWorkers([worker], 'matter')).toBe(1);
    for (let tick = 0; tick < 2_400 && ledger.totalCollected('matter') < 20; tick += 1) {
      movement.update([worker], 1 / 30);
      gathering.update([worker], 1 / 30);
      automation.update([worker], 1 / 30);
    }
    expect(ledger.totalCollected('matter')).toBe(20);
    expect(resources.alive()).toHaveLength(0);
    expect(worker.automation?.resourceType).toBe('matter');
  });
});
