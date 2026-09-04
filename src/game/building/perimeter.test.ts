import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { validatePlacement } from './PlacementController';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { BUILDINGS } from '../../data/buildings';
import type { BuildingEntity } from '../types/simulation';

/**
 * A player must be able to enclose a colony. This walks a rectangular perimeter the way a person
 * would drag one out and reports every segment the placement rules refuse.
 */
describe('walling a colony', () => {
  it('accepts a closed rectangular perimeter of walls', () => {
    const sim = new MatchSimulation({ opponent: false });
    const grid = sim.navigation;
    const core = sim.coreOf('player')!;
    const placed: BuildingEntity[] = [];
    const refused: string[] = [];
    let sequence = 0;

    const tryWall = (x: number, z: number, rotated: boolean): void => {
      const result = validatePlacement('wall', { x, z }, grid, sim.state.buildings.alive(), sim.state.resources.alive(), rotated);
      if (!result.valid) { refused.push(`(${x.toFixed(1)},${z.toFixed(1)})${rotated ? ' rot' : ''}: ${result.failure}`); return; }
      const footprint = rotated ? { x: BUILDINGS.wall.footprint[1], z: BUILDINGS.wall.footprint[0] } : { x: BUILDINGS.wall.footprint[0], z: BUILDINGS.wall.footprint[1] };
      const wall = {
        id: `wall-${sequence++}` as BuildingEntity['id'], kind: 'wall', team: 'player',
        position: result.position, footprint, rotated, alive: true, operational: true,
        hp: 1, maxHp: 1, selected: false, productionQueue: [], builderId: null,
        constructionProgress: 1, constructionTime: 0, vision: 2,
        combat: { targetId: null, cooldown: 0 },
      } as unknown as BuildingEntity;
      sim.state.buildings.add(wall);
      setBuildingOccupancy(grid, wall, true);
      placed.push(wall);
    };

    // A 24 x 16 box centred on the Core, walked clockwise: top and bottom runs use the wall's
    // long axis, the sides use its rotated form. This is the shape a player drags out. A segment
    // is four units long, so that is the step in both orientations.
    const left = core.position.x - 12;
    const right = core.position.x + 12;
    const top = core.position.z - 8;
    const bottom = core.position.z + 8;
    // Runs stop short of the corners so the two orientations never contend for the same cell,
    // which is exactly how a player drags a perimeter out.
    for (let x = left + 4; x <= right - 4; x += 4) { tryWall(x, top, false); tryWall(x, bottom, false); }
    for (let z = top; z <= bottom; z += 4) { tryWall(left, z, true); tryWall(right, z, true); }

    console.log(`placed ${placed.length}, refused ${refused.length}`);
    if (refused.length > 0) console.log(refused.slice(0, 12).join('\n'));
    // Segments that would sit on top of a deposit are legitimately refused; a player routes
    // around those. Nothing else may be.
    expect(refused.every((entry) => entry.endsWith('RESOURCE_OVERLAP'))).toBe(true);
    expect(placed.length).toBeGreaterThanOrEqual(16);
  });

  it('builds every segment of a run placed by one Worker', () => {
    const sim = new MatchSimulation({ opponent: false });
    const economy = sim.economy('player')!;
    economy.ledger.deposit('matter', 2_000);
    economy.ledger.deposit('energy', 500);
    const worker = sim.unitsOf('player').find((unit) => unit.kind === 'worker')!;
    const core = sim.coreOf('player')!;

    // Drag a run: one Worker, ten segments, placed back to back the way the tool arms them.
    let requested = 0;
    for (let index = 0; index < 10; index += 1) {
      const site = { x: core.position.x - 18 + index * 4, z: core.position.z + 11 };
      if (sim.build(worker, 'wall', site).ok) requested += 1;
    }
    expect(requested).toBeGreaterThanOrEqual(8);

    for (let step = 0; step < 300 * 30; step += 1) sim.step(1 / 30);
    const walls = sim.buildingsOf('player').filter((building) => building.kind === 'wall');
    const finished = walls.filter((building) => building.operational);
    console.log(`run: ${requested} requested, ${walls.length} sites, ${finished.length} finished`);
    // Every requested segment must end up standing. Before the builder rolled onto the next
    // site, a run left one finished wall and a row of foundations nobody ever returned to.
    expect(finished.length).toBe(requested);
  }, 120_000);
});
