import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../data/buildings';
import { createBuildingSite } from '../entities/buildings/Building';
import { MatchSimulation } from '../match/MatchSimulation';
import { findPath } from '../navigation/AStar';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { createUnitEntity } from '../scenarios/economy';
import { MovementSystem } from '../systems/MovementSystem';
import { entityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';

const STEP = 1 / 30;

function walk(movement: MovementSystem, unit: UnitEntity, seconds: number): void {
  for (let step = 0; step < Math.round(seconds / STEP); step += 1) movement.update([unit], STEP);
}

/** Blocks a rectangle the way a completed wall would, without needing a whole match. */
function raiseWall(grid: NavigationGrid, x: number, z: number, length: number): void {
  grid.setBlockedRect({ x, z }, { x: 1, z: length }, true, 0);
}

/**
 * A wall is only a wall if it is in the way. Paths are planned once and then walked for seconds,
 * so the movement step -- not the planner -- is what has to keep a unit out of a blocked cell.
 */
describe('walls stop what walks into them', () => {
  it('does not let a unit walk through a wall raised across a route it is already walking', () => {
    const grid = new NavigationGrid(-20, -20, 20, 20);
    const movement = new MovementSystem(grid);
    const unit = createUnitEntity('walker-1', 'striker', 'player', { x: -10, z: 0 });
    unit.path = findPath(grid, unit.position, { x: 10, z: 0 });
    unit.pathIndex = 1;
    unit.destination = { x: 10, z: 0 };
    expect(unit.path.length).toBeGreaterThan(1);

    walk(movement, unit, 0.5);
    expect(unit.position.x).toBeLessThan(0);

    // A curtain across the whole corridor, raised after the route was planned.
    raiseWall(grid, 0, 0, 40);
    walk(movement, unit, 10);

    expect(unit.position.x).toBeLessThan(0);
    expect(unit.destination).toBeNull();
    expect(unit.activity).toBe('Idle');
  });

  it('walks around a wall that only covers part of the route', () => {
    const grid = new NavigationGrid(-20, -20, 20, 20);
    const movement = new MovementSystem(grid);
    const unit = createUnitEntity('walker-2', 'striker', 'player', { x: -10, z: 0 });
    unit.path = findPath(grid, unit.position, { x: 10, z: 0 });
    unit.pathIndex = 1;
    unit.destination = { x: 10, z: 0 };

    walk(movement, unit, 0.5);
    raiseWall(grid, 0, 0, 8);
    walk(movement, unit, 20);

    // Round the end of the wall and on to the far side: blocked, not stopped.
    expect(unit.position.x).toBeGreaterThan(8);
  });

  it('lets a unit that has been built around walk back out', () => {
    const grid = new NavigationGrid(-20, -20, 20, 20);
    const movement = new MovementSystem(grid);
    const unit = createUnitEntity('walker-3', 'worker', 'player', { x: 0.5, z: 0.5 });
    // The cell the unit is standing in is claimed, as it would be by a structure raised on top
    // of it. Refusing every step out of a blocked cell would stand it there for good.
    grid.setBlockedRect({ x: 0.5, z: 0.5 }, { x: 1, z: 1 }, true, 0);
    unit.path = [{ x: 0.5, z: 0.5 }, { x: 3.5, z: 0.5 }];
    unit.pathIndex = 1;
    unit.destination = { x: 3.5, z: 0.5 };

    walk(movement, unit, 3);
    expect(unit.position.x).toBeCloseTo(3.5, 1);
  });

  it('attacks the wall when there is no way around it', () => {
    const sim = new MatchSimulation({ opponent: false, seed: 5 });
    const core = sim.coreOf('player')!;
    // Seal the colony: a ring of completed walls the attacker has no route through.
    let sequence = 0;
    for (let side = 0; side < 4; side += 1) {
      for (let offset = -12; offset <= 12; offset += 4) {
        const horizontal = side < 2;
        const sign = side % 2 === 0 ? -1 : 1;
        const position = horizontal
          ? { x: core.position.x + offset, z: core.position.z + sign * 12 }
          : { x: core.position.x + sign * 12, z: core.position.z + offset };
        const wall = createBuildingSite(entityId(`seal-${sequence++}`), 'wall', 'player', position, entityId('nobody'), !horizontal);
        wall.builderId = null;
        wall.operational = true;
        wall.constructionProgress = 1;
        wall.hp = BUILDINGS.wall.maxHp;
        sim.state.buildings.add(wall);
        setBuildingOccupancy(sim.navigation, wall, true);
      }
    }

    const attacker = createUnitEntity('raider-1', 'striker', 'enemy', { x: core.position.x + 26, z: core.position.z });
    sim.state.units.add(attacker);
    sim.targets.sync([...sim.state.units.alive(), ...sim.state.buildings.alive()]);

    // Ordered onto the Core it cannot reach: it turns on what is standing in the way instead.
    expect(sim.attack([attacker], core)).toBe(1);
    const targeted = sim.state.buildings.get(attacker.combat.targetId!);
    expect(targeted?.kind).toBe('wall');

    const wallHp = targeted!.hp;
    sim.run(60);
    expect(sim.state.buildings.get(targeted!.id)?.hp ?? 0).toBeLessThan(wallHp);
  });
});
