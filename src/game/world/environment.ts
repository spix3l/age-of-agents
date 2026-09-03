import * as THREE from 'three';
import { MAP_BOUNDS, MAP_SIZE, WORLD_OBSTACLES, type WorldObstacle } from './map';

/**
 * Everything on the battlefield that is scenery rather than an entity: the rolling ground,
 * the sandstone mesas that back the navigation obstacles, forests, grass, flowers, and
 * ponds. It is built once, deterministically, and never touched by the simulation.
 */

/** Rolling hills and forest continue this far past the playable bounds before the fog eats them. */
const MARGIN = 76;
const TERRAIN_STEP = 2;

interface Pond { readonly x: number; readonly z: number; readonly radius: number }
const PONDS: readonly Pond[] = [
  { x: 34, z: -116, radius: 19 },
  { x: -150, z: 26, radius: 14 },
  { x: 152, z: -30, radius: 12 },
];

/** Distant sandstone ranges that frame the horizon the way the reference frames its valley. */
const FAR_RANGES: readonly WorldObstacle[] = [
  { id: 'range-north-west', center: { x: -70, z: -136 }, size: { x: 56, z: 22 }, height: 15, rotation: 0.1 },
  { id: 'range-north', center: { x: 4, z: -150 }, size: { x: 44, z: 20 }, height: 13, rotation: -0.06 },
  { id: 'range-north-east', center: { x: 96, z: -138 }, size: { x: 60, z: 24 }, height: 17, rotation: 0.08 },
  { id: 'range-west', center: { x: -166, z: -60 }, size: { x: 26, z: 48 }, height: 14, rotation: 0.14 },
  { id: 'range-west-south', center: { x: -160, z: 80 }, size: { x: 24, z: 40 }, height: 12, rotation: -0.12 },
  { id: 'range-east', center: { x: 168, z: 40 }, size: { x: 26, z: 52 }, height: 15, rotation: -0.1 },
  { id: 'range-east-north', center: { x: 160, z: -84 }, size: { x: 22, z: 34 }, height: 11, rotation: 0.16 },
  { id: 'range-south', center: { x: -20, z: 140 }, size: { x: 60, z: 18 }, height: 10, rotation: 0.04 },
  { id: 'range-south-east', center: { x: 90, z: 134 }, size: { x: 40, z: 18 }, height: 9, rotation: -0.1 },
];

const SANDSTONE = [0x5d6166, 0x6c7076, 0x7b7f84];
const GRASS_CAP = 0x4f7a34;

function hash(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function hash2(x: number, z: number): number {
  return hash(x * 157.31 + z * 311.7);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise in [0, 1]. Cheap, deterministic, and smooth enough for hills. */
function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x); const z0 = Math.floor(z);
  const fx = x - x0; const fz = z - z0;
  const ux = fx * fx * (3 - 2 * fx); const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0); const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1); const d = hash2(x0 + 1, z0 + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uz);
}

function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2.1 + 7.3, z * 2.1 + 3.1) * 0.28 + valueNoise(x * 4.3 + 1.7, z * 4.3 + 9.2) * 0.12;
}

/** Distance from a point to the playable rectangle; zero anywhere inside it. */
function distanceOutside(x: number, z: number): number {
  const dx = Math.max(0, MAP_BOUNDS.minX - x, x - MAP_BOUNDS.maxX);
  const dz = Math.max(0, MAP_BOUNDS.minZ - z, z - MAP_BOUNDS.maxZ);
  return Math.hypot(dx, dz);
}

function pondDepth(x: number, z: number): number {
  let depth = 0;
  for (const pond of PONDS) {
    const d = Math.hypot(x - pond.x, z - pond.z);
    depth = Math.max(depth, smoothstep(pond.radius + 5, pond.radius * 0.45, d));
  }
  return depth;
}

/** Ground height. The playfield itself is perfectly flat so the simulation's plane holds. */
export function terrainHeight(x: number, z: number): number {
  const outside = distanceOutside(x, z);
  if (outside <= 0) return 0;
  const ramp = smoothstep(3, 40, outside);
  const rolling = fbm(x * 0.045, z * 0.045);
  const height = ramp * (4.5 + rolling * 10);
  const basin = pondDepth(x, z);
  return THREE.MathUtils.lerp(height, -1.6, basin);
}

function insideObstacle(x: number, z: number, padding = 1): boolean {
  for (const obstacle of WORLD_OBSTACLES) {
    if (Math.abs(x - obstacle.center.x) <= obstacle.size.x / 2 + padding && Math.abs(z - obstacle.center.z) <= obstacle.size.z / 2 + padding) return true;
  }
  return false;
}

interface TreeSpec { x: number; z: number; y: number; scale: number; pine: boolean; shade: number }

export class Environment {
  readonly group = new THREE.Group();
  readonly terrain: THREE.Mesh;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor() {
    this.terrain = this.buildTerrain();
    this.group.add(this.terrain);
    this.buildWater();
    for (const [index, obstacle] of WORLD_OBSTACLES.entries()) this.buildMesa(obstacle, index, false);
    for (const [index, range] of FAR_RANGES.entries()) this.buildMesa(range, index + 100, true);
    this.buildForest();
    this.buildGroundCover();
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
  }

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildTerrain(): THREE.Mesh {
    const width = MAP_SIZE.width + MARGIN * 2;
    const depth = MAP_SIZE.depth + MARGIN * 2;
    const geometry = this.track(new THREE.PlaneGeometry(width, depth, Math.round(width / TERRAIN_STEP), Math.round(depth / TERRAIN_STEP)));
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    const shadow = new THREE.Color(0x101e26);
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const height = terrainHeight(x, z);
      positions.setY(index, height);

      // Meadow green with broad patches and fine speckle, so the field never reads as one flat tint.
      const patch = fbm(x * 0.02 + 40, z * 0.02 + 40);
      const speckle = hash2(Math.round(x), Math.round(z));
      const hue = 0.235 + patch * 0.035;
      const lightness = 0.17 + patch * 0.07 + speckle * 0.03;
      color.setHSL(hue, 0.42, lightness);
      const outside = distanceOutside(x, z);
      if (outside > 0) {
        // Beyond the map the land is forever unexplored: colder and darker, matching the fog.
        // Dimming starts right at the boundary so no bright band shows past the fog plane.
        const dim = smoothstep(-1, 7, outside);
        color.lerp(shadow, dim * 0.92);
      }
      const basin = pondDepth(x, z);
      if (basin > 0) color.lerp(new THREE.Color(0x2b2f2e), Math.min(1, basin * 1.2));
      colors[index * 3] = color.r; colors[index * 3 + 1] = color.g; colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  private buildWater(): void {
    const material = this.track(new THREE.MeshStandardMaterial({ color: 0x14344a, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.92, flatShading: true }));
    for (const pond of PONDS) {
      const geometry = this.track(new THREE.CircleGeometry(pond.radius + 2, 28));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pond.x, -0.45, pond.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  /**
   * A mesa is a stack of jittered polygon slabs in warm sandstone bands, capped with grass.
   * Its footprint matches the axis-aligned navigation rectangle so units stop at its foot.
   */
  private buildMesa(obstacle: WorldObstacle, seed: number, distant: boolean): void {
    const group = new THREE.Group();
    const base = distant ? terrainHeight(obstacle.center.x, obstacle.center.z) - 1.5 : 0;
    const layers = obstacle.height > 8 ? 5 : obstacle.height > 5 ? 4 : 3;
    const layerHeight = obstacle.height / layers;
    const halfX = obstacle.size.x / 2 + (distant ? 0 : 0.45);
    const halfZ = obstacle.size.z / 2 + (distant ? 0 : 0.45);
    const segments = Math.max(10, Math.round((halfX + halfZ) * 1.3));
    for (let layer = 0; layer <= layers; layer += 1) {
      const isCap = layer === layers;
      const shrink = 1 - layer * 0.07;
      const height = isCap ? 0.55 : layerHeight;
      const geometry = this.track(new THREE.CylinderGeometry(isCap ? shrink * 1.02 : shrink * 0.96, isCap ? shrink * 1.02 : shrink, height, segments, 1, false));
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index); const z = positions.getZ(index);
        const radius = Math.hypot(x, z);
        if (radius < 1e-4) continue;
        const angle = Math.atan2(z, x);
        const wobble = 1 + (fbm(Math.cos(angle) * 2.2 + seed * 3.1, Math.sin(angle) * 2.2 + layer * 1.7) - 0.5) * 0.36;
        positions.setX(index, x * wobble);
        positions.setZ(index, z * wobble);
        if (!isCap) positions.setY(index, positions.getY(index) + (hash(index + seed * 17 + layer) - 0.5) * 0.18);
      }
      geometry.computeVertexNormals();
      const material = this.mesaMaterial(isCap ? -1 : (layer + seed) % SANDSTONE.length, distant);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(halfX, 1, halfZ);
      mesh.position.y = base + (isCap ? obstacle.height + 0.2 : layer * layerHeight + layerHeight / 2);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    // Scree at the foot breaks the clean line where rock meets grass.
    const screeGeometry = this.geometry('scree', () => new THREE.DodecahedronGeometry(1, 0));
    const scree = Math.round((halfX + halfZ) * 0.6);
    for (let index = 0; index < scree; index += 1) {
      const angle = hash(seed * 31 + index * 7) * Math.PI * 2;
      const rock = new THREE.Mesh(screeGeometry, this.mesaMaterial((index + seed) % SANDSTONE.length, distant));
      const size = 0.5 + hash(seed * 13 + index * 5) * 0.9;
      rock.position.set(Math.cos(angle) * (halfX + 0.4), base + size * 0.35, Math.sin(angle) * (halfZ + 0.4));
      rock.scale.set(size * 1.4, size * 0.8, size);
      rock.rotation.set(hash(index) * 0.6, hash(index + 3) * Math.PI, hash(index + 9) * 0.3);
      rock.castShadow = true; rock.receiveShadow = true;
      group.add(rock);
    }
    group.position.set(obstacle.center.x, 0, obstacle.center.z);
    group.rotation.y = obstacle.rotation ?? 0;
    this.group.add(group);
  }

  /** Sandstone bands, or the grass cap for band -1; distant ranges are pre-dimmed into the fog. */
  private mesaMaterial(band: number, distant: boolean): THREE.MeshStandardMaterial {
    const base = band < 0 ? GRASS_CAP : SANDSTONE[band]!;
    if (!distant) return this.material(band < 0 ? 'mesa-cap' : `mesa-${band}`, base);
    const dimmed = new THREE.Color(base).lerp(new THREE.Color(0x101e26), 0.88).getHex();
    return this.material(band < 0 ? 'mesa-cap-far' : `mesa-${band}-far`, dimmed);
  }

  private buildForest(): void {
    const trees: TreeSpec[] = [];
    const push = (x: number, z: number, y: number, seed: number, pineBias: number, dim: number): void => {
      const scale = 0.85 + hash(seed) * 0.8;
      trees.push({ x, z, y, scale, pine: hash(seed + 1) < pineBias, shade: dim });
    };

    // Beyond the bounds the hills are thick with forest, as far as the fog lets you see.
    const seedBase = 5000;
    for (let index = 0; index < 3000; index += 1) {
      const x = MAP_BOUNDS.minX - MARGIN + hash(seedBase + index * 3) * (MAP_SIZE.width + MARGIN * 2);
      const z = MAP_BOUNDS.minZ - MARGIN + hash(seedBase + index * 3 + 1) * (MAP_SIZE.depth + MARGIN * 2);
      const outside = distanceOutside(x, z);
      if (outside < 1.5 || pondDepth(x, z) > 0.05) continue;
      const density = fbm(x * 0.03 + 9, z * 0.03 + 9);
      if (hash(seedBase + index * 3 + 2) > 0.35 + density * 0.6) continue;
      push(x, z, terrainHeight(x, z), index * 11, 0.7, smoothstep(-1, 7, outside) * 0.9);
    }

    // A thin tree line just inside the edge softens the border between field and hills.
    for (let index = 0; index < 420; index += 1) {
      const edge = index % 4;
      const along = hash(seedBase + 20_000 + index * 2);
      const inset = 0.8 + hash(seedBase + 20_001 + index * 2) * 4.2;
      const x = edge < 2 ? MAP_BOUNDS.minX + along * MAP_SIZE.width : edge === 2 ? MAP_BOUNDS.minX + inset : MAP_BOUNDS.maxX - inset;
      const z = edge >= 2 ? MAP_BOUNDS.minZ + along * MAP_SIZE.depth : edge === 0 ? MAP_BOUNDS.minZ + inset : MAP_BOUNDS.maxZ - inset;
      push(x, z, 0, index * 13 + 77, 0.7, 0);
    }

    // Mesa tops carry their own copses.
    for (const [index, obstacle] of [...WORLD_OBSTACLES, ...FAR_RANGES].entries()) {
      const distant = index >= WORLD_OBSTACLES.length;
      const count = Math.round(obstacle.size.x * obstacle.size.z / (distant ? 30 : 16));
      const base = distant ? terrainHeight(obstacle.center.x, obstacle.center.z) - 1.5 : 0;
      const cos = Math.cos(obstacle.rotation ?? 0); const sin = Math.sin(obstacle.rotation ?? 0);
      for (let tree = 0; tree < count; tree += 1) {
        const angle = hash(index * 97 + tree * 3) * Math.PI * 2;
        const radial = Math.sqrt(hash(index * 97 + tree * 3 + 1)) * 0.68;
        const lx = Math.cos(angle) * radial * obstacle.size.x / 2;
        const lz = Math.sin(angle) * radial * obstacle.size.z / 2;
        push(obstacle.center.x + lx * cos - lz * sin, obstacle.center.z + lx * sin + lz * cos, base + obstacle.height + 0.35, index * 97 + tree * 3 + 2, 0.55, distant ? 0.9 : 0);
      }
    }

    // Sparse bushes across the field: small enough that walking through them reads fine.
    const bushes: TreeSpec[] = [];
    for (let index = 0; index < 260; index += 1) {
      const x = MAP_BOUNDS.minX + 6 + hash(seedBase + 40_000 + index * 2) * (MAP_SIZE.width - 12);
      const z = MAP_BOUNDS.minZ + 6 + hash(seedBase + 40_001 + index * 2) * (MAP_SIZE.depth - 12);
      if (insideObstacle(x, z, 2.5)) continue;
      if (Math.hypot(x + 92, z - 60) < 26 || Math.hypot(x - 92, z + 60) < 26) continue;
      bushes.push({ x, z, y: 0, scale: 0.32 + hash(index * 5) * 0.28, pine: false, shade: 0 });
    }

    this.instanceTrees(trees, bushes);
  }

  private instanceTrees(trees: readonly TreeSpec[], bushes: readonly TreeSpec[]): void {
    const rounds = trees.filter((tree) => !tree.pine);
    const pines = trees.filter((tree) => tree.pine);
    const trunkGeometry = this.geometry('tree-trunk', () => new THREE.CylinderGeometry(0.14, 0.24, 1, 5));
    const roundGeometry = this.geometry('tree-round', () => new THREE.IcosahedronGeometry(1, 0));
    const pineGeometry = this.geometry('tree-pine', () => new THREE.ConeGeometry(0.85, 2.1, 6));
    const trunkMaterial = this.material('tree-trunk', 0x4a3524, 1, 0);
    const leafMaterial = this.material('tree-leaf', 0xffffff, 0.95, 0);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const tint = new THREE.Color();
    const dim = new THREE.Color(0x101e26);

    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
    const roundCrowns = new THREE.InstancedMesh(roundGeometry, leafMaterial, rounds.length * 2 + bushes.length);
    const pineCrowns = new THREE.InstancedMesh(pineGeometry, leafMaterial, pines.length * 2);
    let trunkIndex = 0; let roundIndex = 0; let pineIndex = 0;

    const place = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, s: THREE.Vector3, yaw: number, color: THREE.Color): void => {
      euler.set(0, yaw, 0);
      quaternion.setFromEuler(euler);
      position.set(x, y, z);
      matrix.compose(position, quaternion, s);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color);
    };

    for (const [index, tree] of trees.entries()) {
      const yaw = hash(index * 3.3) * Math.PI * 2;
      const trunkHeight = (tree.pine ? 1.1 : 1.35) * tree.scale;
      scale.set(tree.scale, trunkHeight, tree.scale);
      tint.setHex(0x4a3524).lerp(dim, tree.shade);
      place(trunks, trunkIndex, tree.x, tree.y + trunkHeight / 2, tree.z, scale, yaw, tint);
      trunkIndex += 1;
      // Leaf colour drifts between spring lime and deep pine so a forest is never one green.
      const leafHue = 0.27 + hash(index * 7.7) * 0.1;
      tint.setHSL(leafHue, 0.38 + hash(index * 2.1) * 0.15, 0.2 + hash(index * 4.9) * 0.1).lerp(dim, tree.shade);
      if (tree.pine) {
        scale.set(tree.scale * 1.05, tree.scale * 1.15, tree.scale * 1.05);
        place(pineCrowns, pineIndex, tree.x, tree.y + trunkHeight + tree.scale * 0.95, tree.z, scale, yaw, tint);
        scale.set(tree.scale * 0.72, tree.scale * 0.9, tree.scale * 0.72);
        place(pineCrowns, pineIndex + 1, tree.x, tree.y + trunkHeight + tree.scale * 2.05, tree.z, scale, yaw + 0.5, tint);
        pineIndex += 2;
      } else {
        scale.set(tree.scale * 1.15, tree.scale * 1.05, tree.scale * 1.15);
        place(roundCrowns, roundIndex, tree.x, tree.y + trunkHeight + tree.scale * 0.75, tree.z, scale, yaw, tint);
        scale.set(tree.scale * 0.78, tree.scale * 0.72, tree.scale * 0.78);
        place(roundCrowns, roundIndex + 1, tree.x + tree.scale * 0.25, tree.y + trunkHeight + tree.scale * 1.55, tree.z - tree.scale * 0.2, scale, yaw + 0.8, tint);
        roundIndex += 2;
      }
    }
    for (const [index, bush] of bushes.entries()) {
      tint.setHSL(0.27 + hash(index * 9.1) * 0.06, 0.4, 0.22 + hash(index * 1.3) * 0.08);
      scale.set(bush.scale * 1.3, bush.scale, bush.scale * 1.2);
      place(roundCrowns, roundIndex, bush.x, bush.y + bush.scale * 0.55, bush.z, scale, hash(index) * Math.PI, tint);
      roundIndex += 1;
    }
    for (const mesh of [trunks, roundCrowns, pineCrowns]) {
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.track(mesh);
      this.group.add(mesh);
    }
  }

  /** Grass tufts, wildflowers, and pebbles across the playable field. */
  private buildGroundCover(): void {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const tint = new THREE.Color();
    const fill = (mesh: THREE.InstancedMesh, count: number, seed: number, minScale: number, maxScale: number, colorAt: (index: number) => THREE.Color, height: (s: number) => number, flatten: number): void => {
      let placed = 0;
      for (let attempt = 0; attempt < count * 2 && placed < count; attempt += 1) {
        const x = MAP_BOUNDS.minX + 2 + hash(seed + attempt * 2) * (MAP_SIZE.width - 4);
        const z = MAP_BOUNDS.minZ + 2 + hash(seed + attempt * 2 + 1) * (MAP_SIZE.depth - 4);
        if (insideObstacle(x, z, 0.8)) continue;
        const s = minScale + hash(seed + attempt * 7) * (maxScale - minScale);
        euler.set(0, hash(seed + attempt * 5) * Math.PI * 2, 0);
        quaternion.setFromEuler(euler);
        position.set(x, height(s), z);
        scale.set(s, s * flatten, s);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(placed, matrix);
        mesh.setColorAt(placed, colorAt(attempt));
        placed += 1;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.receiveShadow = true;
      this.track(mesh);
      this.group.add(mesh);
    };

    const tufts = new THREE.InstancedMesh(this.geometry('tuft', () => new THREE.ConeGeometry(0.22, 0.55, 3)), this.material('tuft', 0xffffff, 1, 0), 4200);
    fill(tufts, 4200, 900, 0.45, 0.9, (index) => tint.setHSL(0.24 + hash(index * 3.7) * 0.04, 0.45, 0.2 + hash(index * 1.9) * 0.1), (s) => s * 0.22, 1);

    const flowers = new THREE.InstancedMesh(this.geometry('flower', () => new THREE.SphereGeometry(0.12, 5, 4)), this.material('flower', 0xffffff, 0.9, 0), 700);
    const petals = [0xf3e39a, 0xe6b64d, 0xd9d3a8, 0x9fc9d8];
    fill(flowers, 700, 4400, 0.8, 1.3, (index) => tint.setHex(petals[Math.floor(hash(index * 2.3) * petals.length)]!), () => 0.14, 0.8);

    const pebbles = new THREE.InstancedMesh(this.geometry('pebble', () => new THREE.DodecahedronGeometry(0.18, 0)), this.material('pebble', 0xffffff, 0.95, 0.05), 420);
    pebbles.castShadow = true;
    fill(pebbles, 420, 7800, 0.6, 1.6, (index) => tint.setHSL(0.6, 0.05, 0.28 + hash(index * 5.1) * 0.15), (s) => s * 0.07, 0.6);
  }

  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  private geometry<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
    const existing = this.geometries.get(key);
    if (existing) return existing as T;
    const created = this.track(build());
    this.geometries.set(key, created);
    return created;
  }

  private material(key: string, color: number, roughness = 0.96, metalness = 0.02): THREE.MeshStandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;
    const created = this.track(new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true }));
    this.materials.set(key, created);
    return created;
  }
}
