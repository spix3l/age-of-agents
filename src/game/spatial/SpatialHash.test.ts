import { describe, expect, it } from 'vitest';
import { entityId } from '../types/ids';
import type { Team, Vec2 } from '../types/simulation';
import { SpatialHash } from './SpatialHash';

interface Probe { readonly id: ReturnType<typeof entityId>; alive: boolean; team: Team; position: { x: number; z: number } }

function probe(index: number, position: Vec2, team: Team = 'enemy'): Probe {
  return { id: entityId(`probe-${index}`), alive: true, team, position: { ...position } };
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function brute(entities: readonly Probe[], center: Vec2, radius: number, filter: (entity: Probe) => boolean): Probe[] {
  return entities.filter((entity) => entity.alive && filter(entity)
    && Math.hypot(entity.position.x - center.x, entity.position.z - center.z) <= radius);
}

describe('SpatialHash', () => {
  it('matches a brute-force scan for randomized positions and radii', () => {
    const random = seeded(97);
    const hash = new SpatialHash<Probe>(8);
    const entities = Array.from({ length: 400 }, (_, index) => probe(index, { x: random() * 160 - 80, z: random() * 120 - 60 }));
    entities.forEach((entity) => hash.insert(entity));
    for (let query = 0; query < 40; query += 1) {
      const center = { x: random() * 160 - 80, z: random() * 120 - 60 };
      const radius = 1 + random() * 20;
      const found = hash.query(center, radius).map((entity) => entity.id).sort();
      const expected = brute(entities, center, radius, () => true).map((entity) => entity.id).sort();
      expect(found).toEqual(expected);
    }
  });

  it('finds entities across cell boundaries and never returns duplicates', () => {
    const hash = new SpatialHash<Probe>(4);
    const straddling = [
      probe(1, { x: 3.9, z: 3.9 }), probe(2, { x: 4.1, z: 3.9 }),
      probe(3, { x: 3.9, z: 4.1 }), probe(4, { x: 4.1, z: 4.1 }),
      probe(5, { x: -0.1, z: -0.1 }),
    ];
    straddling.forEach((entity) => hash.insert(entity));
    const found = hash.query({ x: 4, z: 4 }, 6);
    expect(found).toHaveLength(5);
    expect(new Set(found.map((entity) => entity.id)).size).toBe(5);
  });

  it('follows movement across cells and drops removed or dead entities', () => {
    const hash = new SpatialHash<Probe>(8);
    const mover = probe(10, { x: 0, z: 0 });
    hash.insert(mover);
    expect(hash.query({ x: 30, z: 0 }, 2)).toHaveLength(0);
    mover.position.x = 30;
    hash.update(mover);
    expect(hash.query({ x: 30, z: 0 }, 2)).toHaveLength(1);
    expect(hash.query({ x: 0, z: 0 }, 2)).toHaveLength(0);
    expect(hash.size).toBe(1);

    mover.alive = false;
    hash.sync([mover]);
    expect(hash.size).toBe(0);
    expect(hash.remove(mover.id)).toBe(false);
  });

  it('excludes friendly and dead entities from hostile queries', () => {
    const hash = new SpatialHash<Probe>(8);
    const friend = probe(20, { x: 1, z: 1 }, 'player');
    const foe = probe(21, { x: 2, z: 1 }, 'enemy');
    const neutral = probe(22, { x: 2, z: 2 }, 'neutral');
    const corpse = probe(23, { x: 1, z: 2 }, 'enemy');
    corpse.alive = false;
    [friend, foe, neutral, corpse].forEach((entity) => hash.insert(entity));

    const hostiles = hash.queryHostiles({ x: 1, z: 1 }, 5, 'player');
    expect(hostiles.map((entity) => entity.id)).toEqual([foe.id]);
    expect(hash.nearestHostile({ x: 1, z: 1 }, 5, 'player')?.id).toBe(foe.id);
    expect(hash.queryHostiles({ x: 1, z: 1 }, 5, 'neutral')).toHaveLength(0);
  });

  it('exposes query load counters instead of scanning every entity', () => {
    const hash = new SpatialHash<Probe>(8);
    Array.from({ length: 300 }, (_, index) => probe(index, { x: (index % 30) * 5 - 75, z: Math.floor(index / 30) * 5 - 25 }))
      .forEach((entity) => hash.insert(entity));
    hash.resetCounters();
    hash.query({ x: 0, z: 0 }, 4);
    const counters = hash.counters();
    expect(counters.queries).toBe(1);
    expect(counters.cellsVisited).toBeLessThanOrEqual(9);
    expect(counters.candidatesTested).toBeLessThan(300);
    expect(counters.tracked).toBe(300);
  });
});
