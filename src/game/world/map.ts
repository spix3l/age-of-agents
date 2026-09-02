import type { Vec2 } from '../types/simulation';

export const MAP_BOUNDS = Object.freeze({ minX: -36, maxX: 36, minZ: -26, maxZ: 26 });

export interface WorldObstacle {
  readonly id: string;
  readonly center: Vec2;
  readonly size: Readonly<{ x: number; z: number }>;
  readonly height: number;
  readonly rotation?: number;
}

export const WORLD_OBSTACLES: readonly WorldObstacle[] = Object.freeze([
  { id: 'ridge-west', center: { x: -12, z: 1 }, size: { x: 5, z: 20 }, height: 3.8, rotation: -0.12 },
  { id: 'ridge-east', center: { x: 11, z: -5 }, size: { x: 5, z: 18 }, height: 4.6, rotation: 0.1 },
  { id: 'spire-north', center: { x: 6, z: 15 }, size: { x: 9, z: 5 }, height: 5.4 },
  { id: 'spire-south', center: { x: -1, z: -19 }, size: { x: 12, z: 4 }, height: 3.2 },
]);
