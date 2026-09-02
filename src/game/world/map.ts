import type { Vec2 } from '../types/simulation';

/** 120 x 88 battlefield: two corner bases with a wide contested middle between them. */
export const MAP_BOUNDS = Object.freeze({ minX: -60, maxX: 60, minZ: -44, maxZ: 44 });

export const MAP_SIZE = Object.freeze({
  width: MAP_BOUNDS.maxX - MAP_BOUNDS.minX,
  depth: MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ,
});

/** Faction start positions. Everything else in the scenario is laid out relative to these. */
export const START_POSITIONS = Object.freeze({
  player: Object.freeze({ x: -44, z: 28 }),
  enemy: Object.freeze({ x: 44, z: -28 }),
});

export interface WorldObstacle {
  readonly id: string;
  readonly center: Vec2;
  readonly size: Readonly<{ x: number; z: number }>;
  readonly height: number;
  readonly rotation?: number;
}

/**
 * Terrain is handcrafted and deterministic. Ridges frame each base's approach and break the
 * middle into lanes so armies meet at readable choke points instead of one open field.
 */
export const WORLD_OBSTACLES: readonly WorldObstacle[] = Object.freeze([
  { id: 'ridge-west', center: { x: -30, z: 6 }, size: { x: 6, z: 26 }, height: 4.2, rotation: -0.12 },
  { id: 'ridge-east', center: { x: 29, z: -8 }, size: { x: 6, z: 24 }, height: 4.8, rotation: 0.1 },
  { id: 'ridge-north', center: { x: 8, z: 30 }, size: { x: 26, z: 6 }, height: 4.4, rotation: 0.06 },
  { id: 'ridge-south', center: { x: -9, z: -31 }, size: { x: 24, z: 6 }, height: 4 },
  { id: 'spire-centre-north', center: { x: -6, z: 12 }, size: { x: 9, z: 7 }, height: 5.6 },
  { id: 'spire-centre-south', center: { x: 7, z: -13 }, size: { x: 9, z: 7 }, height: 5.6 },
  { id: 'crag-northwest', center: { x: -46, z: -6 }, size: { x: 7, z: 14 }, height: 3.6, rotation: 0.2 },
  { id: 'crag-southeast', center: { x: 45, z: 8 }, size: { x: 7, z: 14 }, height: 3.6, rotation: -0.2 },
  { id: 'outcrop-north', center: { x: 30, z: 26 }, size: { x: 11, z: 5 }, height: 3.2, rotation: 0.24 },
  { id: 'outcrop-south', center: { x: -31, z: -26 }, size: { x: 11, z: 5 }, height: 3.2, rotation: -0.24 },
]);
