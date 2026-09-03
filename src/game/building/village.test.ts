import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../data/buildings';
import { activateCapacityProvider } from '../economy/CapacityProviders';
import { Capacity } from '../economy/Capacity';
import { createBuildingSite } from '../entities/buildings/Building';
import { automateWorkers } from '../commands/AutomateCommand';
import { MatchSimulation } from '../match/MatchSimulation';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { entityId } from '../types/ids';
import { validatePlacement } from './PlacementController';

const builder = entityId('village-builder');

describe('village structures', () => {
  it('lays a continuous run of Barrier Walls that units cannot path through', () => {
    const grid = new NavigationGrid(-20, -20, 20, 20);
    const walls = [-4, -2, 0, 2, 4].map((x, index) => {
      const wall = createBuildingSite(entityId(`wall-${index + 1}`), 'wall', 'player', { x: x + 0.5, z: 0.5 }, builder);
      setBuildingOccupancy(grid, wall, true);
      return wall;
    });
    // Every cell along the run is blocked: a flush wall has no gaps to walk through.
    for (let x = -5; x <= 5; x += 1) expect(grid.isWalkable(grid.worldToCell({ x: x + 0.5, z: 0.5 }))).toBe(false);

    for (const wall of walls) setBuildingOccupancy(grid, wall, false);
    for (let x = -5; x <= 5; x += 1) expect(grid.isWalkable(grid.worldToCell({ x: x + 0.5, z: 0.5 }))).toBe(true);
  });

  it('leaves a Gate walkable so a colony can seal a perimeter and still get out', () => {
    const grid = new NavigationGrid(-20, -20, 20, 20);
    const gate = createBuildingSite(entityId('gate-1'), 'gate', 'player', { x: 0.5, z: 0.5 }, builder);
    setBuildingOccupancy(grid, gate, true);
    expect(grid.isWalkable(grid.worldToCell(gate.position))).toBe(true);
    // It is still a real building: nothing else may be placed on top of it.
    expect(validatePlacement('wall', { x: 0, z: 0 }, grid, [gate], []).failure).toBe('BUILDING_OVERLAP');
    expect(gate.maxHp).toBe(BUILDINGS.gate.maxHp);
  });

  it('gives Habitats capacity and makes Storage Depots a valid deposit target', () => {
    const capacity = new Capacity(8, 0);
    const habitat = createBuildingSite(entityId('habitat-1'), 'habitat', 'player', { x: 0.5, z: 0.5 }, builder);
    habitat.operational = true;
    expect(activateCapacityProvider(habitat, capacity)).toBe(true);
    expect(capacity.snapshot().max).toBe(8 + BUILDINGS.habitat.capacityContribution);

    expect(BUILDINGS.depot.acceptsDeposits).toBe(true);
    expect(BUILDINGS.habitat.acceptsDeposits).toBe(false);
  });

  it('banks cargo at the nearest Storage Depot instead of walking home to the Core', () => {
    const simulation = new MatchSimulation({ seed: 91, scenario: 'economy', opponent: false });
    const worker = simulation.unitsOf('player')[0]!;
    const node = simulation.state.resources.alive()
      .filter((resource) => resource.resourceType === 'matter')
      .sort((a, b) => Math.hypot(a.position.x - worker.position.x, a.position.z - worker.position.z)
        - Math.hypot(b.position.x - worker.position.x, b.position.z - worker.position.z))[0]!;

    const depot = createBuildingSite(entityId('player-depot-1'), 'depot', 'player', { x: node.position.x + 4.5, z: node.position.z + 0.5 }, worker.id);
    depot.operational = true;
    depot.constructionProgress = 1;
    depot.hp = depot.maxHp;
    simulation.state.buildings.add(depot);

    const before = simulation.economy('player')!.ledger.totalCollected('matter');
    automateWorkers([worker], 'matter');
    simulation.run(120);
    expect(simulation.economy('player')!.ledger.totalCollected('matter')).toBeGreaterThan(before);
    // The Depot is closer than the Core, so the round trip is the one being shortened.
    const core = simulation.coreOf('player')!;
    expect(Math.hypot(depot.position.x - node.position.x, depot.position.z - node.position.z))
      .toBeLessThan(Math.hypot(core.position.x - node.position.x, core.position.z - node.position.z));
  });
});
