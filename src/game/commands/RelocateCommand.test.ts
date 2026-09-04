import { describe, expect, it } from 'vitest';
import { GameState } from '../GameState';
import { createBuildingSite } from '../entities/buildings/Building';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { entityId, type BuildingTypeId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { canRelocate, issueRelocateCommand, validateRelocation } from './RelocateCommand';

function harness() {
  const state = new GameState();
  const navigation = new NavigationGrid(0, 0, 40, 40);
  const add = (building: BuildingEntity): BuildingEntity => {
    state.buildings.add(building);
    setBuildingOccupancy(navigation, building, true);
    return building;
  };
  const completed = (kind: Exclude<BuildingTypeId, 'core'>, x: number, z: number, rotated = false): BuildingEntity => {
    const site = createBuildingSite(entityId(`player-${kind}-${x}-${z}`), kind, 'player', { x, z }, entityId('builder'), rotated);
    site.operational = true;
    site.constructionProgress = 1;
    return add(site);
  };
  return { state, navigation, add, completed, context: { state, navigation } };
}

/** Whether the cell under a world point is still walkable. */
function walkable(world: ReturnType<typeof harness>, at: { x: number; z: number }): boolean {
  return world.navigation.isWalkable(world.navigation.worldToCell(at));
}

describe('relocating a structure', () => {
  it('moves a completed structure and hands its old cells back', () => {
    const world = harness();
    const relay = world.completed('relay', 10, 10);
    expect(canRelocate(relay)).toBe(true);

    const result = issueRelocateCommand(relay, { x: 24, z: 24 }, world.context);
    expect(result.ok).toBe(true);
    expect(relay.position).toEqual({ x: 24, z: 24 });
    expect(world.navigation.isWalkable(world.navigation.worldToCell({ x: 10, z: 10 }))).toBe(true);
    expect(world.navigation.isWalkable(world.navigation.worldToCell({ x: 24, z: 24 }))).toBe(false);
    // The entity survives the move: same id, same registry slot.
    expect(world.state.buildings.get(relay.id)).toBe(relay);
  });

  it('does not collide with the cells it is standing on, so a one-step nudge is legal', () => {
    const world = harness();
    const wall = world.completed('wall', 10, 10);
    const result = issueRelocateCommand(wall, { x: 10, z: 11 }, world.context);
    expect(result.ok).toBe(true);
    expect(wall.position).toEqual({ x: 10, z: 11.5 });
  });

  it('quarter-turns the footprint when the relocation is rotated', () => {
    const world = harness();
    const wall = world.completed('wall', 10, 10);
    expect(wall.footprint).toEqual({ x: 4, z: 1 });
    const result = issueRelocateCommand(wall, { x: 20, z: 20 }, world.context, true);
    expect(result.ok).toBe(true);
    expect(wall.rotated).toBe(true);
    expect(wall.footprint).toEqual({ x: 1, z: 4 });
    // Occupancy follows the turned footprint: the run goes along z now, not along x.
    expect(walkable(world, { x: 20.5, z: 19.5 })).toBe(false);
    expect(walkable(world, { x: 20.5, z: 20.5 })).toBe(false);
    expect(walkable(world, { x: 19.5, z: 20.5 })).toBe(true);
  });

  it('rejects an occupied target and leaves the structure exactly where it was', () => {
    const world = harness();
    const relay = world.completed('relay', 10, 10);
    world.add(createCore(entityId('player-core'), 'player', { x: 24, z: 24 }));

    const result = issueRelocateCommand(relay, { x: 24, z: 24 }, world.context);
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_PLACEMENT' });
    expect(relay.position).toEqual({ x: 10, z: 10 });
    // A refused move must not leave the old footprint unblocked.
    expect(world.navigation.isWalkable(world.navigation.worldToCell({ x: 10, z: 10 }))).toBe(false);
  });

  it('refuses a resource node, the Core, and anything still under construction', () => {
    const world = harness();
    const relay = world.completed('relay', 10, 10);
    world.state.resources.add(createResourceNode(entityId('matter'), 'matter', { x: 30, z: 30 }, 100));
    expect(validateRelocation(relay, { x: 30, z: 30 }, world.context).failure).toBe('RESOURCE_OVERLAP');

    const core = world.add(createCore(entityId('player-core'), 'player', { x: 6, z: 6 }));
    expect(canRelocate(core)).toBe(false);
    expect(issueRelocateCommand(core, { x: 20, z: 20 }, world.context)).toMatchObject({ ok: false, reason: 'NOT_RELOCATABLE' });

    const site = world.add(createBuildingSite(entityId('player-depot-site'), 'depot', 'player', { x: 16, z: 16 }, entityId('builder')));
    expect(canRelocate(site)).toBe(false);
    expect(issueRelocateCommand(site, { x: 20, z: 20 }, world.context)).toMatchObject({ ok: false, reason: 'UNDER_CONSTRUCTION' });
  });

  it('never touches the grid for a structure that died mid-relocation', () => {
    const world = harness();
    const relay = world.completed('relay', 10, 10);
    setBuildingOccupancy(world.navigation, relay, false);
    relay.alive = false;
    expect(validateRelocation(relay, { x: 24, z: 24 }, world.context).valid).toBe(false);
    expect(world.navigation.isWalkable(world.navigation.worldToCell({ x: 10, z: 10 }))).toBe(true);
    expect(issueRelocateCommand(relay, { x: 24, z: 24 }, world.context)).toMatchObject({ ok: false, reason: 'NOT_RELOCATABLE' });
  });
});
