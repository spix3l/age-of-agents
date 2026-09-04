import { describe, expect, it, vi } from 'vitest';
import { Capacity } from '../economy/Capacity';
import { EntityRegistry } from '../entities/core/EntityRegistry';
import { BUILDINGS } from '../../data/buildings';
import { createBuildingSite } from '../entities/buildings/Building';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createWorkerEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { MovementSystem } from './MovementSystem';
import { ConstructionSystem, constructionRefund, CONSTRUCTION_REFUND_RATIO } from './ConstructionSystem';

describe('construction', () => {
  it('routes a Worker, advances simulation progress, and activates Relay capacity only on completion', () => {
    const grid = new NavigationGrid(0, 0, 30, 30);
    const buildings = new EntityRegistry<BuildingEntity>();
    const worker = createWorkerEntity('construction-worker', 'player', { x: 4, z: 10 });
    const site = createBuildingSite(entityId('relay-site'), 'relay', 'player', { x: 12.5, z: 10.5 }, worker.id);
    buildings.add(site);
    grid.setBlockedRect(site.position, site.footprint, true, 0.35);
    const capacity = new Capacity(8, 3);
    const completed = vi.fn((building: BuildingEntity) => capacity.addProvider(building.capacityContribution));
    const construction = new ConstructionSystem(buildings, grid, completed);
    expect(construction.assign(worker, site)).toBe(true);
    expect(capacity.snapshot().max).toBe(8);
    const movement = new MovementSystem(grid);
    for (let tick = 0; tick < 600 && !site.operational; tick += 1) {
      movement.update([worker], 1 / 30);
      construction.update([worker], 1 / 30);
    }
    expect(site.operational).toBe(true);
    expect(site.hp).toBe(site.maxHp);
    expect(worker.buildOrder).toBeNull();
    expect(capacity.snapshot().max).toBe(13);
    expect(completed).toHaveBeenCalledOnce();
  });

  it('documents the 75 percent construction cancellation refund', () => {
    const site = createBuildingSite(entityId('fabricator-refund-site'), 'fabricator', 'player', { x: 10, z: 10 }, entityId('refund-worker'));
    const cost = BUILDINGS.fabricator.cost;
    expect(constructionRefund(site)).toEqual({
      matter: Math.floor(cost.matter! * CONSTRUCTION_REFUND_RATIO),
      energy: Math.floor(cost.energy! * CONSTRUCTION_REFUND_RATIO),
    });
  });

  it('clears the previous Worker when a site is reassigned', () => {
    const grid = new NavigationGrid(0, 0, 30, 30);
    const buildings = new EntityRegistry<BuildingEntity>();
    const first = createWorkerEntity('first-builder', 'player', { x: 4, z: 10 });
    const replacement = createWorkerEntity('replacement-builder', 'player', { x: 5, z: 10 });
    const site = createBuildingSite(entityId('reassigned-site'), 'relay', 'player', { x: 12.5, z: 10.5 }, first.id);
    buildings.add(site);
    grid.setBlockedRect(site.position, site.footprint, true, 0.35);
    const construction = new ConstructionSystem(buildings, grid, vi.fn());

    expect(construction.assign(first, site)).toBe(true);
    expect(construction.assign(replacement, site)).toBe(true);
    construction.update([first, replacement], 1 / 30);

    expect(first.buildOrder).toBeNull();
    expect(replacement.buildOrder).toEqual({ buildingId: site.id });
    expect(site.builderId).toBe(replacement.id);
  });
});
