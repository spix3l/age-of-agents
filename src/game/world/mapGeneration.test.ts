import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { createEconomyScenario } from '../scenarios/economy';
import { gatherApproachCell } from '../systems/GatheringSystem';
import { MAP_BOUNDS, START_POSITIONS } from './map';
import { findPath } from '../navigation/AStar';

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 256, 1_024, 20_260_902];

describe('seeded map generation', () => {
  it('is reproducible for a fixed seed and different across seeds', () => {
    const signature = (seed: number): string => createEconomyScenario(seed).resources
      .map((node) => `${node.resourceType}@${node.position.x.toFixed(1)},${node.position.z.toFixed(1)}`)
      .join('|');
    expect(signature(7)).toBe(signature(7));
    const signatures = new Set(SEEDS.map(signature));
    expect(signatures.size).toBe(SEEDS.length);
  });

  it('mirrors both factions exactly, so no seed favours a side', () => {
    for (const seed of SEEDS) {
      const { resources } = createEconomyScenario(seed);
      for (const node of resources) {
        // Every node must have a counterpart rotated 180 degrees about the origin, of the same
        // type and the same size. A node at the centre is its own counterpart.
        const mirrored = resources.find((other) => other !== node
          && other.resourceType === node.resourceType
          && Math.abs(other.position.x + node.position.x) < 0.01
          && Math.abs(other.position.z + node.position.z) < 0.01);
        const atCentre = Math.hypot(node.position.x, node.position.z) < 0.01;
        expect(Boolean(mirrored) || atCentre, `seed ${seed}: ${node.id} has no mirror`).toBe(true);
        if (mirrored) expect(mirrored.capacity, `seed ${seed}: ${node.id} size`).toBe(node.capacity);
      }
    }
  });

  it('keeps every node inside the map and harvestable', () => {
    for (const seed of SEEDS) {
      const sim = new MatchSimulation({ seed, opponent: false });
      for (const node of sim.state.resources.alive()) {
        expect(node.position.x, `seed ${seed}`).toBeGreaterThan(MAP_BOUNDS.minX);
        expect(node.position.x, `seed ${seed}`).toBeLessThan(MAP_BOUNDS.maxX);
        expect(node.position.z, `seed ${seed}`).toBeGreaterThan(MAP_BOUNDS.minZ);
        expect(node.position.z, `seed ${seed}`).toBeLessThan(MAP_BOUNDS.maxZ);
        // The D6 defect this guards: a node with no walkable cell in extraction range silently
        // starves every Worker that ranks it closest.
        expect(gatherApproachCell(sim.navigation, node), `seed ${seed}: ${node.id} unharvestable`).not.toBeNull();
      }
    }
  });

  it('gives both starts a reachable opening economy of all three resources', () => {
    for (const seed of SEEDS) {
      const sim = new MatchSimulation({ seed, opponent: false });
      for (const team of ['player', 'enemy'] as const) {
        const start = START_POSITIONS[team];
        for (const type of ['matter', 'energy', 'data'] as const) {
          const near = sim.state.resources.alive()
            .filter((node) => node.resourceType === type)
            .filter((node) => Math.hypot(node.position.x - start.x, node.position.z - start.z) < 34)
            .filter((node) => findPath(sim.navigation, start, node.position).length > 0);
          expect(near.length, `seed ${seed} ${team} ${type}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries enough total resource to field a real army', () => {
    for (const seed of SEEDS) {
      const { resources } = createEconomyScenario(seed);
      const total = (type: string): number => resources
        .filter((node) => node.resourceType === type)
        .reduce((sum, node) => sum + node.capacity, 0);
      // The handcrafted map capped armies near 20 units because it simply did not hold enough
      // Matter. These floors are what a sustained war needs.
      expect(total('matter'), `seed ${seed} matter`).toBeGreaterThan(9_000);
      expect(total('energy'), `seed ${seed} energy`).toBeGreaterThan(4_500);
      expect(total('data'), `seed ${seed} data`).toBeGreaterThan(1_500);
    }
  });
});
