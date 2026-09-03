import { describe, expect, it } from 'vitest';
import { findPath, pathMetrics, resetPathMetrics } from './AStar';
import { NavigationGrid } from './NavigationGrid';
import { issueMoveCommand } from '../commands/MoveCommand';
import { MovementSystem } from '../systems/MovementSystem';
import { MatchSimulation } from '../match/MatchSimulation';
import { createUnitEntity, createWorkerEntity } from '../scenarios/economy';
import { MAP_BOUNDS, START_POSITIONS } from '../world/map';
import type { UnitEntity } from '../types/simulation';

const shippingGrid = (): NavigationGrid => new MatchSimulation({ opponent: false }).navigation;

/**
 * Release-blocker regressions for D7-03. Each case is a movement failure that was reproducible
 * before the fix, so a regression fails here rather than in a playtest.
 */
describe('pathing release blockers', () => {
  it('answers a cross-map route without sweeping the map', () => {
    const grid = shippingGrid();
    resetPathMetrics();
    const path = findPath(grid, START_POSITIONS.player, START_POSITIONS.enemy);
    expect(path.length).toBeGreaterThan(1);
    // Expansions, not milliseconds: the count is deterministic, so it means the same thing on
    // every machine and under any test-suite load. A corner-to-corner route across a
    // 42,240-cell map settles around 5,100 cells; well under a tenth of the grid.
    expect(pathMetrics.expansions).toBeLessThan(8_000);
  });

  it('answers a cross-map route inside a frame budget', { retry: 2 }, () => {
    const grid = shippingGrid();
    // Warm the JIT and the scratch buffers: the first search of a process is not the one a
    // player ever feels, and timing it makes the check flaky rather than strict.
    findPath(grid, START_POSITIONS.player, START_POSITIONS.enemy);
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const start = performance.now();
      findPath(grid, START_POSITIONS.player, START_POSITIONS.enemy);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    // The linear-scan open set took 17-24ms for exactly this search on an unloaded machine, so
    // this ceiling separates the two implementations while tolerating a busy CI box.
    expect(samples[2]).toBeLessThan(12);
  });

  it('orders a 30-unit group across the map without a visible stall', { retry: 2 }, () => {
    const grid = shippingGrid();
    const units: UnitEntity[] = [];
    for (let index = 0; index < 30; index += 1) {
      units.push(createUnitEntity(`group-${index}`, 'striker', 'player', {
        x: START_POSITIONS.player.x + (index % 6),
        z: START_POSITIONS.player.z + Math.floor(index / 6),
      }));
    }
    resetPathMetrics();
    const start = performance.now();
    const result = issueMoveCommand(units, START_POSITIONS.enemy, grid);
    const elapsed = performance.now() - start;
    expect(result.issued).toBe(30);
    expect(units.every((unit) => unit.path.length > 0)).toBe(true);
    expect(pathMetrics.searches).toBe(30);
    // This whole command used to cost 418ms on an unloaded machine — a visible freeze on every
    // group order — so the ceiling still separates the implementations under suite contention.
    expect(elapsed).toBeLessThan(250);
  });

  it('fails an unreachable order quickly and leaves the unit visibly idle', () => {
    const grid = shippingGrid();
    // Wall a unit into its own pocket: exactly what a player can do with Barrier Walls.
    const origin = grid.worldToCell(START_POSITIONS.player);
    for (let dc = -3; dc <= 3; dc += 1) {
      for (let dr = -3; dr <= 3; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== 3) continue;
        grid.setBlocked({ col: origin.col + dc, row: origin.row + dr }, true);
      }
    }
    const unit = createWorkerEntity('boxed-in', 'player', START_POSITIONS.player);
    const start = performance.now();
    const result = issueMoveCommand([unit], START_POSITIONS.enemy, grid);
    const elapsed = performance.now() - start;
    expect(result.issued).toBe(0);
    expect(unit.path).toEqual([]);
    expect(unit.destination).toBeNull();
    expect(elapsed).toBeLessThan(50);
  });

  it('caps the work one search may do rather than sweeping the whole map', () => {
    const grid = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    // An open map with an unreachable goal is the worst case: nothing prunes the frontier.
    for (let row = 0; row < grid.rows; row += 1) grid.setBlocked({ col: grid.columns - 3, row }, true);
    resetPathMetrics();
    expect(findPath(grid, { x: MAP_BOUNDS.minX + 2, z: 0 }, { x: MAP_BOUNDS.maxX - 1, z: 0 })).toEqual([]);
    expect(pathMetrics.expansions).toBeLessThanOrEqual(12_000);
  });

  it('caps repath attempts so a blocked unit stops retrying forever', () => {
    const grid = new NavigationGrid(0, 0, 20, 20);
    const unit = createWorkerEntity('blocked', 'player', { x: 2.5, z: 2.5 });
    issueMoveCommand([unit], { x: 17.5, z: 17.5 }, grid);
    expect(unit.repathCount).toBe(0);
    // Seal the route after the order: the unit walks into the new wall and gives up.
    for (let row = 0; row < 20; row += 1) grid.setBlocked({ col: 10, row }, true);
    const movement = new MovementSystem(grid);
    for (let tick = 0; tick < 30 * 30; tick += 1) movement.update([unit], 1 / 30);
    expect(unit.repathCount).toBeLessThanOrEqual(2);
    expect(unit.activity).not.toBe('Moving');
  });

  it('lets a unit spawned inside a built-up base path back out of it', () => {
    const sim = new MatchSimulation({ opponent: false });
    const worker = sim.state.units.alive().find((unit) => unit.team === 'player' && unit.kind === 'worker');
    expect(worker).toBeDefined();
    const core = sim.state.buildings.alive().find((building) => building.team === 'player' && building.kind === 'core');
    expect(core).toBeDefined();
    // Stand the unit right on the Core's footprint, where a freshly produced Agent appears.
    worker!.position = { x: core!.position.x, z: core!.position.z };
    const issued = issueMoveCommand([worker!], START_POSITIONS.enemy, sim.navigation);
    expect(issued.issued).toBe(1);
    expect(worker!.path.length).toBeGreaterThan(1);
  });

  it('keeps every unit moving or finished through a 15-minute AI match', () => {
    const sim = new MatchSimulation({ seed: 10 });
    const stalled: string[] = [];
    const lastMoved = new Map<string, number>();
    const lastPosition = new Map<string, { x: number; z: number }>();
    for (let step = 0; step < 15 * 60 * 30 && !sim.match.isOver; step += 1) {
      sim.step(1 / 30);
      if (step % 30 !== 0) continue;
      for (const unit of sim.state.units.alive()) {
        const previous = lastPosition.get(unit.id);
        const moved = !previous || Math.hypot(unit.position.x - previous.x, unit.position.z - previous.z) > 0.05;
        lastPosition.set(unit.id, { x: unit.position.x, z: unit.position.z });
        // Only a unit that still believes it is travelling can be stuck. Standing still while
        // extracting, building, shooting, or idle is correct behaviour.
        const travelling = unit.destination !== null && unit.pathIndex < unit.path.length;
        if (moved || !travelling) { lastMoved.set(unit.id, sim.elapsedSeconds); continue; }
        const since = sim.elapsedSeconds - (lastMoved.get(unit.id) ?? sim.elapsedSeconds);
        if (since > 30) stalled.push(`${unit.id} held a destination for ${since.toFixed(0)}s without moving`);
      }
    }
    expect([...new Set(stalled)]).toEqual([]);
  }, 300_000);
});
