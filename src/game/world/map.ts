import type { Vec2 } from '../types/simulation';

/**
 * 300 x 224 battlefield: two far corner bases with a deep contested interior between them.
 *
 * The start positions deliberately did not move when the field grew: the opening, the walking
 * distances between the two colonies, and every balance figure tuned against them are unchanged.
 * The extra ground is open country on all four sides, so a colony can sprawl and an army can
 * flank instead of running into an invisible line a few strides past the tree cover.
 */
export const MAP_BOUNDS = Object.freeze({ minX: -150, maxX: 150, minZ: -112, maxZ: 112 });

/**
 * How far scenery (hills, forest, distant ranges) continues past the playable bounds before the
 * fog swallows it. Shared by the terrain, the tree line, and the fog overlay so all three end in
 * the same place; a multiple of the vision cell size, which keeps the fog texture cell-aligned.
 */
export const MAP_MARGIN = 76;

export const MAP_SIZE = Object.freeze({
  width: MAP_BOUNDS.maxX - MAP_BOUNDS.minX,
  depth: MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ,
});

/** Faction start positions. Everything else in the scenario is laid out relative to these. */
export const START_POSITIONS = Object.freeze({
  player: Object.freeze({ x: -92, z: 60 }),
  enemy: Object.freeze({ x: 92, z: -60 }),
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
 * interior into lanes so armies meet at readable choke points instead of one open field. On a
 * map this size the home basins are deliberately roomy: a colony needs somewhere to sprawl.
 */
export const WORLD_OBSTACLES: readonly WorldObstacle[] = Object.freeze([
  // Home basin walls: they shape each start without crowding the buildable ground.
  { id: 'ridge-player-north', center: { x: -74, z: 78 }, size: { x: 34, z: 8 }, height: 5.2, rotation: 0.08 },
  { id: 'ridge-player-east', center: { x: -52, z: 44 }, size: { x: 8, z: 30 }, height: 5, rotation: -0.1 },
  { id: 'ridge-enemy-south', center: { x: 74, z: -78 }, size: { x: 34, z: 8 }, height: 5.2, rotation: -0.08 },
  { id: 'ridge-enemy-west', center: { x: 52, z: -44 }, size: { x: 8, z: 30 }, height: 5, rotation: 0.1 },

  // Mid-field ridges: the lanes armies actually travel down.
  { id: 'ridge-west', center: { x: -58, z: 4 }, size: { x: 7, z: 40 }, height: 4.6, rotation: -0.12 },
  { id: 'ridge-east', center: { x: 57, z: -6 }, size: { x: 7, z: 38 }, height: 4.8, rotation: 0.1 },
  { id: 'ridge-north', center: { x: 16, z: 62 }, size: { x: 40, z: 7 }, height: 4.6, rotation: 0.06 },
  { id: 'ridge-south', center: { x: -17, z: -63 }, size: { x: 38, z: 7 }, height: 4.4 },

  // Central massif: the landmark both factions navigate around.
  { id: 'spire-centre-north', center: { x: -14, z: 22 }, size: { x: 14, z: 11 }, height: 6.4 },
  { id: 'spire-centre-south', center: { x: 15, z: -23 }, size: { x: 14, z: 11 }, height: 6.4 },
  { id: 'spire-centre-east', center: { x: 26, z: 12 }, size: { x: 10, z: 16 }, height: 5.8, rotation: 0.18 },
  { id: 'spire-centre-west', center: { x: -27, z: -13 }, size: { x: 10, z: 16 }, height: 5.8, rotation: -0.18 },

  // Flank crags: cover for expansions out on the open wings.
  { id: 'crag-northwest', center: { x: -96, z: 6 }, size: { x: 9, z: 22 }, height: 4, rotation: 0.2 },
  { id: 'crag-southeast', center: { x: 95, z: -8 }, size: { x: 9, z: 22 }, height: 4, rotation: -0.2 },
  { id: 'crag-northeast', center: { x: 88, z: 46 }, size: { x: 18, z: 8 }, height: 3.8, rotation: 0.16 },
  { id: 'crag-southwest', center: { x: -89, z: -47 }, size: { x: 18, z: 8 }, height: 3.8, rotation: -0.16 },
  { id: 'outcrop-north', center: { x: 44, z: 52 }, size: { x: 16, z: 7 }, height: 3.6, rotation: 0.24 },
  { id: 'outcrop-south', center: { x: -45, z: -53 }, size: { x: 16, z: 7 }, height: 3.6, rotation: -0.24 },
  { id: 'outcrop-far-north', center: { x: -18, z: 74 }, size: { x: 14, z: 7 }, height: 3.4, rotation: -0.2 },
  { id: 'outcrop-far-south', center: { x: 19, z: -75 }, size: { x: 14, z: 7 }, height: 3.4, rotation: 0.2 },
]);
