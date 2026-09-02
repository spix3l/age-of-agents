import { COMBAT } from '../../data/combat';
import type { EntityId } from '../types/ids';
import type { SimEntity, Team, Vec2 } from '../types/simulation';

export interface SpatialCounters {
  readonly inserts: number;
  readonly updates: number;
  readonly removals: number;
  readonly queries: number;
  readonly cellsVisited: number;
  readonly candidatesTested: number;
  readonly tracked: number;
}

type Spatial = Pick<SimEntity, 'id' | 'alive' | 'team'> & { readonly position: Vec2 };

/**
 * Uniform grid of world-space buckets. Radius queries only visit the cells the circle
 * overlaps, so target acquisition never scans every entity in the match.
 */
export class SpatialHash<T extends Spatial = Spatial> {
  private readonly cells = new Map<number, Map<EntityId, T>>();
  private readonly membership = new Map<EntityId, number>();
  private inserts = 0;
  private updates = 0;
  private removals = 0;
  private queries = 0;
  private cellsVisited = 0;
  private candidatesTested = 0;

  constructor(readonly cellSize: number = COMBAT.spatialCellSize) {
    if (cellSize <= 0) throw new Error('Spatial cell size must be positive');
  }

  get size(): number { return this.membership.size; }

  insert(entity: T): void {
    const key = this.keyFor(entity.position);
    const current = this.membership.get(entity.id);
    if (current === key) { this.bucket(key).set(entity.id, entity); return; }
    if (current !== undefined) this.detach(entity.id, current);
    this.bucket(key).set(entity.id, entity);
    this.membership.set(entity.id, key);
    this.inserts += 1;
  }

  /** Moves an entity between cells when it has crossed a boundary; inserts it if unknown. */
  update(entity: T): void {
    const key = this.keyFor(entity.position);
    const current = this.membership.get(entity.id);
    if (current === undefined) { this.insert(entity); return; }
    this.bucket(current).set(entity.id, entity);
    if (current === key) return;
    this.detach(entity.id, current);
    this.bucket(key).set(entity.id, entity);
    this.membership.set(entity.id, key);
    this.updates += 1;
  }

  remove(id: EntityId): boolean {
    const current = this.membership.get(id);
    if (current === undefined) return false;
    this.detach(id, current);
    this.membership.delete(id);
    this.removals += 1;
    return true;
  }

  has(id: EntityId): boolean { return this.membership.has(id); }

  /** Rebuilds membership from an authoritative list, dropping entities that are gone or dead. */
  sync(entities: Iterable<T>): void {
    const seen = new Set<EntityId>();
    for (const entity of entities) {
      if (!entity.alive) continue;
      seen.add(entity.id);
      this.update(entity);
    }
    for (const id of [...this.membership.keys()]) if (!seen.has(id)) this.remove(id);
  }

  query(center: Vec2, radius: number, filter?: (entity: T) => boolean): T[] {
    this.queries += 1;
    const results: T[] = [];
    if (radius <= 0) return results;
    const radiusSquared = radius * radius;
    const minCol = Math.floor((center.x - radius) / this.cellSize);
    const maxCol = Math.floor((center.x + radius) / this.cellSize);
    const minRow = Math.floor((center.z - radius) / this.cellSize);
    const maxRow = Math.floor((center.z + radius) / this.cellSize);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const bucket = this.cells.get(this.key(col, row));
        this.cellsVisited += 1;
        if (!bucket) continue;
        for (const entity of bucket.values()) {
          this.candidatesTested += 1;
          if (!entity.alive) continue;
          const dx = entity.position.x - center.x;
          const dz = entity.position.z - center.z;
          if (dx * dx + dz * dz > radiusSquared) continue;
          if (filter && !filter(entity)) continue;
          results.push(entity);
        }
      }
    }
    return results;
  }

  queryHostiles(center: Vec2, radius: number, team: Team, extra?: (entity: T) => boolean): T[] {
    if (team === 'neutral') return [];
    return this.query(center, radius, (entity) => (
      entity.team !== 'neutral' && entity.team !== team && (!extra || extra(entity))
    ));
  }

  nearestHostile(center: Vec2, radius: number, team: Team, extra?: (entity: T) => boolean): T | null {
    let best: T | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.queryHostiles(center, radius, team, extra)) {
      const distance = Math.hypot(candidate.position.x - center.x, candidate.position.z - center.z);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
    }
    return best;
  }

  counters(): SpatialCounters {
    return {
      inserts: this.inserts, updates: this.updates, removals: this.removals,
      queries: this.queries, cellsVisited: this.cellsVisited,
      candidatesTested: this.candidatesTested, tracked: this.membership.size,
    };
  }

  resetCounters(): void {
    this.inserts = 0; this.updates = 0; this.removals = 0;
    this.queries = 0; this.cellsVisited = 0; this.candidatesTested = 0;
  }

  clear(): void {
    this.cells.clear();
    this.membership.clear();
  }

  private bucket(key: number): Map<EntityId, T> {
    const existing = this.cells.get(key);
    if (existing) return existing;
    const created = new Map<EntityId, T>();
    this.cells.set(key, created);
    return created;
  }

  private detach(id: EntityId, key: number): void {
    const bucket = this.cells.get(key);
    if (!bucket) return;
    bucket.delete(id);
    if (bucket.size === 0) this.cells.delete(key);
  }

  private keyFor(position: Vec2): number {
    return this.key(Math.floor(position.x / this.cellSize), Math.floor(position.z / this.cellSize));
  }

  private key(col: number, row: number): number {
    // Pairing that stays collision-free for the map's coordinate range, including negatives.
    return (col + 4096) * 16_384 + (row + 4096);
  }
}
