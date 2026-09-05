import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS } from '../../../data/buildings';
import type { BuildingTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import type { ResourceCache } from './palette';
import { detailBuilding } from './machinery';
import { applyMachineryMaterials } from './machineryMaterials';

export interface BuildingModel {
  readonly group: THREE.Group;
  /** Parts the renderer animates: orbit rings, dishes, production arms, energy columns. */
  readonly spinners: THREE.Object3D[];
  readonly column: THREE.Object3D | null;
  readonly arm: THREE.Object3D | null;
  readonly pickable: THREE.Object3D[];
  readonly generationParts: readonly GenerationPart[];
}

/** A block of structure that only appears once its Generation has been reached. */
export interface GenerationPart { readonly part: THREE.Object3D; readonly min: 2 | 3 }

function tag(object: THREE.Object3D, id: string, pickable: THREE.Object3D[]): THREE.Object3D {
  object.userData.entityId = id;
  object.castShadow = true;
  object.receiveShadow = true;
  pickable.push(object);
  return object;
}

type Vec3 = [number, number, number];

/**
 * Vocabulary every structure is assembled from. One material language across the colony:
 * bevelled gunmetal slabs, faction-tinted armour panels, dark structural frame, thin faction
 * light strips along edges, and shared warning-orange lamps.
 */
class Kit {
  readonly pickable: THREE.Object3D[] = [];
  constructor(readonly cache: ResourceCache, readonly team: Team, readonly id: string) {}

  box(key: string, size: Vec3, material: THREE.Material, at: Vec3, radius = 0.06, pick = true): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.roundedBox(key, ...size, radius), material);
    mesh.position.set(...at);
    if (pick) tag(mesh, this.id, this.pickable); else { mesh.castShadow = true; mesh.receiveShadow = true; }
    return mesh;
  }

  /** An octagonal (or otherwise polygonal) drum: the signature plan of the colony's masses. */
  drum(key: string, radiusTop: number, radiusBottom: number, height: number, material: THREE.Material, at: Vec3, sides = 8, pick = true): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.geometry(key, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides)), material);
    mesh.rotation.y = Math.PI / sides;
    mesh.position.set(...at);
    if (pick) tag(mesh, this.id, this.pickable); else { mesh.castShadow = true; mesh.receiveShadow = true; }
    return mesh;
  }

  /** A thin faction light strip. Strips along edges are what make a dark hull read at range. */
  strip(key: string, size: Vec3, at: Vec3, yaw = 0, intensity = 2.2): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.geometry(key, () => new THREE.BoxGeometry(...size)), this.cache.glow(this.team, intensity));
    mesh.position.set(...at);
    mesh.rotation.y = yaw;
    return mesh;
  }

  /** A ring of light strips around a polygonal drum, one per face, at the given radius. */
  ringStrips(key: string, radius: number, y: number, length: number, thickness = 0.06, sides = 8, intensity = 2.2, at: Vec3 = [0, 0, 0]): THREE.Group {
    const group = new THREE.Group();
    for (let index = 0; index < sides; index += 1) {
      const angle = (index + 0.5) * (Math.PI * 2 / sides) + Math.PI / sides;
      group.add(this.strip(key, [length * 0.58, thickness, thickness], [Math.cos(angle) * radius, y, Math.sin(angle) * radius], -angle + Math.PI / 2, intensity));
    }
    group.position.set(...at);
    return group;
  }

  /** A warning lamp: small orange emitter that gives every structure a second, warmer accent. */
  lamp(key: string, at: Vec3, size = 0.12): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.roundedBox(key, size, size * 0.6, size, 0.02), this.cache.amber());
    mesh.position.set(...at);
    return mesh;
  }

  /** A sloped armour skirt around a rectangular mass. */
  skirt(key: string, width: number, depth: number, height: number, material: THREE.Material, at: Vec3): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.geometry(key, () => new THREE.CylinderGeometry(1, 1.28, 1, 4, 1).rotateY(Math.PI / 4)), material);
    mesh.scale.set(width / Math.SQRT2, height, depth / Math.SQRT2);
    mesh.position.set(...at);
    tag(mesh, this.id, this.pickable);
    return mesh;
  }

  glowMesh(key: string, build: () => THREE.BufferGeometry, at: Vec3, intensity = 2): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.geometry(key, build), this.cache.glow(this.team, intensity));
    mesh.position.set(...at);
    return mesh;
  }

  /**
   * A ring of dark buttress pods with a lit face, set around a polygonal mass. This is the
   * reference art's signature silhouette: the bulk is a bright armoured drum, and what makes it
   * read as machinery rather than a cake is the dark pods bolted around its skirt.
   */
  podRing(key: string, radius: number, y: number, count: number, size: Vec3, at: Vec3 = [0, 0, 0], phase = 0): THREE.Group {
    const group = new THREE.Group();
    const frame = this.cache.frame(this.team);
    for (let index = 0; index < count; index += 1) {
      const angle = phase + (index / count) * Math.PI * 2;
      const pod = this.box(`${key}-pod`, size, frame, [Math.cos(angle) * radius, y, Math.sin(angle) * radius], 0.05, false);
      pod.rotation.y = -angle;
      group.add(pod);
      // The lit face points outward, so a ring of pods reads as a ring of lights at range.
      const lens = this.strip(`${key}-pod-lens`, [size[0] * 0.52, size[1] * 0.44, 0.05],
        [Math.cos(angle) * (radius + size[2] / 2), y, Math.sin(angle) * (radius + size[2] / 2)], -angle, 2.4);
      group.add(lens);
    }
    group.position.set(...at);
    return group;
  }

  /**
   * The dark plinth every structure stands on. Value contrast at the ground line is what stops a
   * white building from dissolving into a pale floor.
   */
  chassis(key: string, radius: number, height: number, at: Vec3 = [0, 0, 0], sides = 8): THREE.Mesh {
    return this.drum(key, radius, radius * 1.06, height, this.cache.frame(this.team), [at[0], at[1] + height / 2, at[2]], sides);
  }

  /** A dark seam between two bright masses, so tiers read as separate plates rather than a cone. */
  seam(key: string, radius: number, y: number, sides = 8): THREE.Mesh {
    return this.drum(key, radius, radius, 0.14, this.cache.panel(), [0, y, 0], sides, false);
  }

  antenna(key: string, at: Vec3, height = 1.2): THREE.Group {
    const group = new THREE.Group();
    const mast = new THREE.Mesh(this.cache.geometry(`${key}-mast-${height}`, () => new THREE.CylinderGeometry(0.04, 0.06, height, 5)), this.cache.steel());
    mast.position.y = height / 2;
    const bulb = this.glowMesh(`${key}-bulb`, () => new THREE.SphereGeometry(0.09, 6, 5), [0, height + 0.06, 0], 2.6);
    group.add(mast, bulb);
    group.position.set(...at);
    return group;
  }
}

/**
 * Core: a stepped octagonal ziggurat. Three armoured tiers ringed with light strips rise to a
 * reactor throat that fires a column of light into the sky; the colony's beacon from anywhere.
 */
function buildCore(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  const hull = cache.hull(team); const plate = cache.plate(team); const frame = cache.frame(team);

  group.add(kit.drum('core-plinth', 2.9, 3.05, 0.4, frame, [0, 0.2, 0]));
  group.add(kit.ringStrips('core-plinth-strip', 2.92, 0.36, 2.1, 0.05, 8, 1.8));
  group.add(kit.podRing('core-skirt', 2.72, 0.62, 8, [0.62, 0.72, 0.5], [0, 0, 0], Math.PI / 8));
  const tiers: Array<[number, number, number, number]> = [[2.55, 2.8, 1.3, 0.4], [2.0, 2.3, 1.2, 1.7], [1.45, 1.75, 1.1, 2.9]];
  for (const [index, [top, bottom, height, y]] of tiers.entries()) {
    group.add(kit.drum(`core-tier-${index}`, top, bottom, height, index === 1 ? plate : hull, [0, y + height / 2, 0]));
    // A dark collar where each tier meets the next: the reference separates every plate.
    group.add(kit.seam(`core-seam-${index}`, bottom + 0.03, y + 0.05));
    group.add(kit.ringStrips(`core-tier-strip-${index}`, top + 0.02, y + height - 0.12, top * 0.72, 0.06, 8, 2.4));
    for (let side = 0; side < 4; side += 1) {
      const angle = side * Math.PI / 2 + Math.PI / 4;
      group.add(kit.lamp('core-lamp', [Math.cos(angle) * (bottom - 0.05), y + 0.35, Math.sin(angle) * (bottom - 0.05)], 0.16));
    }
  }
  for (const side of [-1, 1]) {
    group.add(kit.box('core-buttress', [0.6, 1.5, 1.1], frame, [side * 2.3, 0.85, 0], 0.06));
    group.add(kit.box('core-buttress-z', [1.1, 1.5, 0.6], frame, [0, 0.85, side * 2.3], 0.06));
    group.add(kit.strip('core-buttress-strip', [0.08, 1.0, 0.08], [side * 2.62, 0.95, 0]));
    group.add(kit.strip('core-buttress-strip', [0.08, 1.0, 0.08], [0, 0.95, side * 2.62]));
  }
  // Independent sloped armour plates interrupt the concentric tiers with structural ribs.
  for (let side = 0; side < 8; side++) {
    const angle = side * Math.PI / 4;
    const rib = new THREE.Group();
    rib.rotation.y = angle;
    const brace = kit.box('core-armour-rib', [0.65, 2.55, 0.62], hull, [0, 1.75, 2.22], 0.12);
    brace.rotation.x = -0.28;
    rib.add(brace);
    rib.add(kit.box('core-rib-foot', [0.9, 0.62, 1.0], frame, [0, 0.5, 2.58], 0.09));
    rib.add(kit.box('core-rib-cap', [0.72, 0.28, 0.68], hull, [0, 3.16, 1.87], 0.07));
    rib.add(kit.box('core-rib-hazard', [0.34, 0.09, 0.06], cache.hazard(), [0, 0.82, 3.09], 0.01));
    rib.add(kit.strip('core-rib-light', [0.07, 0.8, 0.05], [0, 1.8, 2.62], 0, 1.2));
    group.add(rib);
  }
  group.add(kit.box('core-front-door', [1.0, 1.25, 0.25], frame, [0, 0.9, 2.88], 0.06));
  group.add(kit.box('core-door-header', [1.1, 0.15, 0.3], cache.hazard(), [0, 1.6, 2.86], 0.03));
  group.add(kit.strip('core-door-optic', [0.35, 0.12, 0.04], [0, 1.18, 3.03], 0, 1.5));
  group.add(kit.box('core-gate', [1.4, 1.1, 0.3], frame, [0, 0.95, -2.75], 0.04));
  group.add(kit.strip('core-gate-strip', [1.0, 0.7, 0.08], [0, 0.95, -2.92], 0, 1.4));

  group.add(kit.drum('core-throat', 0.9, 1.15, 0.9, frame, [0, 4.45, 0]));
  group.add(kit.drum('core-throat-lip', 1.2, 1.05, 0.2, plate, [0, 4.95, 0]));
  group.add(kit.ringStrips('core-throat-strip', 1.2, 4.95, 0.7, 0.08, 8, 2.8));
  const column = kit.glowMesh('core-column', () => new THREE.CylinderGeometry(0.035, 0.22, 3.4, 8), [0, 6.5, 0], 2.6);
  const glowColor = cache.glow(team).color.getHex();
  const beam = new THREE.Mesh(
    cache.geometry('core-beam', () => new THREE.CylinderGeometry(0.01, 0.46, 4.2, 8, 1, true)),
    cache.standard(`core-beam-${team}`, { color: glowColor, emissive: glowColor, emissiveIntensity: 1.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, flatShading: false }),
  );
  beam.position.y = 6.9;
  const crown = kit.glowMesh('core-crown', () => new THREE.OctahedronGeometry(0.5, 0), [0, 5.55, 0], 2.2);
  tag(crown, kit.id, kit.pickable);
  group.add(column, beam, crown);
  for (const [index, radius] of [0.58, 0.72].entries()) {
    const ring = kit.glowMesh(`core-ring-${index}`, () => new THREE.TorusGeometry(radius, 0.025, 6, 28), [0, 5.0 + index * 0.15, 0], 1.0);
    ring.rotation.x = Math.PI / 2 + (index === 0 ? 0.2 : -0.14);
    group.add(ring);
    spinners.push(ring);
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    group.add(kit.antenna('core-antenna', [Math.cos(angle) * 1.55, 4.0, Math.sin(angle) * 1.55], 0.9));
  }

  const autonomyCrown = kit.glowMesh('core-autonomy-crown', () => new THREE.TorusGeometry(1.0, 0.09, 6, 12), [0, 7.4, 0], 1.6);
  autonomyCrown.rotation.x = Math.PI / 2;
  autonomyCrown.visible = false;
  const singularityHalo = kit.glowMesh('core-singularity-halo', () => new THREE.TorusGeometry(1.6, 0.08, 6, 18), [0, 8.2, 0], 2);
  singularityHalo.rotation.x = Math.PI / 2;
  singularityHalo.visible = false;
  group.add(autonomyCrown, singularityHalo);
  spinners.push(autonomyCrown, singularityHalo);
  return { group, spinners, column, arm: null, pickable: kit.pickable, generationParts: [{ part: autonomyCrown, min: 2 }, { part: singularityHalo, min: 3 }] };
}

/** Relay Node: a tall octagonal signal tower banded with light, topped by a dish and antenna. */
function buildRelay(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  group.add(kit.drum('relay-plinth', 1.0, 1.1, 0.35, cache.frame(team), [0, 0.18, 0]));
  group.add(kit.drum('relay-base', 0.8, 0.95, 1.2, cache.hull(team), [0, 0.95, 0]));
  group.add(kit.ringStrips('relay-base-strip', 0.9, 1.35, 0.5, 0.06));
  group.add(kit.drum('relay-shaft', 0.55, 0.7, 2.2, cache.plate(team), [0, 2.55, 0]));
  for (const y of [2.0, 2.7, 3.4]) group.add(kit.ringStrips('relay-shaft-strip', 0.62, y, 0.34, 0.05, 8, 1.8));
  group.add(kit.drum('relay-head', 0.85, 0.6, 0.5, cache.hull(team), [0, 3.9, 0]));
  group.add(kit.lamp('relay-lamp', [0.6, 4.0, -0.6], 0.14));
  group.add(kit.lamp('relay-lamp', [-0.6, 4.0, 0.6], 0.14));
  const dishMount = new THREE.Group();
  dishMount.position.set(0, 4.25, 0);
  const dish = new THREE.Mesh(cache.geometry('relay-dish', () => new THREE.ConeGeometry(0.55, 0.35, 8, 1, true)), cache.steel());
  dish.rotation.set(Math.PI * 0.72, 0, 0.3);
  dish.position.set(0.3, 0.1, -0.2);
  const feed = kit.glowMesh('relay-feed', () => new THREE.SphereGeometry(0.09, 6, 5), [0.3, 0.38, -0.42], 2.2);
  dishMount.add(dish, feed);
  tag(dish, kit.id, kit.pickable);
  spinners.push(dishMount);
  group.add(dishMount, kit.antenna('relay-antenna', [-0.3, 4.15, 0.25], 1.4));
  const column = kit.glowMesh('relay-column', () => new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), [0, 2.55, 0], 1.6);
  column.visible = false;
  group.add(column);
  return { group, spinners, column, arm: null, pickable: kit.pickable, generationParts: [] };
}

/** Fabricator: an armoured assembly bunker with a lit bay door, sloped skirt, and a roof crane. */
function buildFabricator(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  group.add(kit.box('fab-floor', [4.1, 0.28, 3.1], cache.frame(team), [0, 0.14, 0], 0.05));
  group.add(kit.skirt('fab-skirt', 3.6, 2.7, 0.9, cache.hull(team), [0, 0.72, 0]));
  group.add(kit.box('fab-hall', [3.2, 1.3, 2.3], cache.hull(team), [0, 1.75, 0], 0.08));
  group.add(kit.box('fab-roof', [3.4, 0.24, 2.5], cache.hull(team), [0, 2.45, 0], 0.05));
  group.add(kit.drum('fab-roof-socket', 1.1, 1.25, 0.18, cache.frame(team), [0, 2.63, 0], 8));
  group.add(kit.drum('fab-roof-armour', 0.96, 1.08, 0.18, cache.hull(team), [0, 2.79, 0], 8));
  group.add(kit.drum('fab-roof-hatch', 0.64, 0.72, 0.12, cache.plate(team), [0, 2.94, 0], 8));
  for (const side of [-1, 1]) {
    group.add(kit.box('fab-side-rail', [0.16, 0.16, 2.0], cache.steel(), [side * 1.5, 2.66, 0], 0.03));
    for (let vent = 0; vent < 5; vent++) group.add(kit.box('fab-side-vent', [0.05, 0.12, 0.65], cache.frame(team), [side * 1.62, 1.65 + vent * 0.13, 0], 0.01));
  }
  group.add(kit.box('fab-cabin', [1.4, 0.7, 1.1], cache.plate(team), [-0.7, 2.9, 0.3], 0.06));
  group.add(kit.strip('fab-cabin-strip', [1.2, 0.08, 0.08], [-0.7, 3.2, -0.25]));
  group.add(kit.strip('fab-edge', [3.3, 0.07, 0.07], [0, 2.4, -1.25]));
  group.add(kit.strip('fab-edge', [3.3, 0.07, 0.07], [0, 2.4, 1.25]));
  group.add(kit.strip('fab-edge-z', [0.07, 0.07, 2.4], [1.72, 2.4, 0]));
  group.add(kit.strip('fab-edge-z', [0.07, 0.07, 2.4], [-1.72, 2.4, 0]));
  group.add(kit.box('fab-door-frame', [1.9, 1.3, 0.2], cache.hull(team), [0.3, 0.75, -1.5], 0.04, false));
  group.add(kit.strip('fab-door', [1.5, 0.95, 0.08], [0.3, 0.72, -1.62], 0, 1.3));
  group.add(kit.box('fab-stripe', [3.0, 0.14, 0.05], cache.hazard(), [0, 1.35, -1.38], 0.01, false));
  for (const x of [-1.4, 1.4]) group.add(kit.lamp('fab-lamp', [x, 2.62, -1.0]));
  group.add(kit.drum('fab-vent', 0.3, 0.36, 0.9, cache.frame(team), [1.1, 2.9, 0.5], 6));
  group.add(kit.antenna('fab-antenna', [1.3, 2.55, -0.6], 1.0));

  const arm = new THREE.Group();
  arm.position.set(0.3, 2.35, -1.9);
  arm.userData.restY = 2.35;
  const rail = kit.box('fab-rail', [3.0, 0.08, 0.1], cache.steel(), [0, 0, 0], 0.02, false);
  const hoist = kit.box('fab-hoist', [0.3, 0.4, 0.3], cache.plate(team), [0, -0.26, 0], 0.03, false);
  const spark = kit.glowMesh('fab-spark', () => new THREE.SphereGeometry(0.08, 6, 5), [0, -0.52, 0], 2.6);
  arm.add(rail, hoist, spark);
  group.add(arm);
  return { group, spinners: [], column: null, arm, pickable: kit.pickable, generationParts: [] };
}

/** Barrier Wall: a chunky armoured segment with a lit panel and a warning lamp. */
function buildWall(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  group.add(kit.box('wall-base', [4.0, 0.3, 1.0], cache.frame(team), [0, 0.15, 0], 0.03));
  group.add(kit.box('wall-slab', [4.0, 1.5, 0.7], cache.hull(team), [0, 1.05, 0], 0.06));
  group.add(kit.box('wall-cap', [4.0, 0.24, 0.84], cache.hull(team), [0, 1.9, 0], 0.03));
  for (const side of [-1, 1]) {
    group.add(kit.box('wall-joint', [0.14, 1.62, 0.83], cache.frame(team), [side * 1.93, 1.08, 0], 0.025));
    for (const face of [-1, 1]) {
      group.add(kit.box('wall-inset', [1.72, 0.64, 0.1], cache.plate(team), [side, 1.18, face * 0.4], 0.04));
      group.add(kit.strip('wall-panel', [0.55, 0.07, 0.06], [side, 1.15, face * 0.47], 0, 1.3));
    }
  }
  group.add(kit.strip('wall-ridge', [3.9, 0.06, 0.06], [0, 2.05, 0], 0, 1.8));
  group.add(kit.lamp('wall-lamp', [1.8, 2.08, 0], 0.1));
  return { group, spinners: [], column: null, arm: null, pickable: kit.pickable, generationParts: [] };
}

/** Field Outpost: a tall sensor pillar with a banded shaft and a sweeping beacon. */
function buildOutpost(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  group.add(kit.drum('outpost-plinth', 1.5, 1.65, 0.4, cache.frame(team), [0, 0.2, 0]));
  group.add(kit.drum('outpost-base', 1.1, 1.35, 1.3, cache.hull(team), [0, 1.05, 0]));
  group.add(kit.ringStrips('outpost-base-strip', 1.2, 1.55, 0.7, 0.06));
  group.add(kit.strip('outpost-hatch', [0.8, 0.7, 0.08], [0, 0.85, -1.32], 0, 1.3));
  group.add(kit.drum('outpost-shaft', 0.6, 0.8, 2.6, cache.plate(team), [0, 3.0, 0]));
  for (const y of [2.3, 3.0, 3.7]) group.add(kit.ringStrips('outpost-shaft-strip', 0.7, y, 0.38, 0.05, 8, 1.8));
  group.add(kit.drum('outpost-head', 0.95, 0.7, 0.6, cache.hull(team), [0, 4.6, 0]));
  group.add(kit.ringStrips('outpost-head-strip', 0.98, 4.7, 0.6, 0.07, 8, 2.4));
  for (const angle of [0.6, 2.7, 4.8]) group.add(kit.lamp('outpost-lamp', [Math.cos(angle) * 0.85, 4.95, Math.sin(angle) * 0.85], 0.12));
  const eye = kit.glowMesh('outpost-eye', () => new THREE.SphereGeometry(0.2, 8, 6), [0, 5.15, 0], 2.2);
  tag(eye, kit.id, kit.pickable);
  spinners.push(eye);
  group.add(eye, kit.antenna('outpost-antenna', [0, 5.2, 0], 1.3));
  return { group, spinners, column: eye, arm: null, pickable: kit.pickable, generationParts: [] };
}

/** Zap Turret: a hexagonal emplacement with a swivelling head and twin coil guns. */
function buildTurret(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  group.add(kit.drum('turret-plinth', 1.05, 1.2, 0.4, cache.frame(team), [0, 0.2, 0], 6));
  group.add(kit.drum('turret-base', 0.8, 0.95, 0.8, cache.hull(team), [0, 0.8, 0], 6));
  group.add(kit.ringStrips('turret-base-strip', 0.86, 1.1, 0.6, 0.06, 6));
  group.add(kit.drum('turret-neck', 0.4, 0.5, 0.5, cache.hull(team), [0, 1.45, 0], 8));
  const head = new THREE.Group();
  head.position.y = 1.95;
  const dome = kit.box('turret-head', [1.1, 0.6, 1.0], cache.plate(team), [0, 0, 0], 0.1);
  const visor = kit.strip('turret-eye', [0.5, 0.12, 0.08], [0, 0.05, -0.5], 0, 2.4);
  for (const side of [-1, 1]) {
    const barrel = new THREE.Mesh(cache.geometry('turret-gun', () => new THREE.CylinderGeometry(0.09, 0.12, 1.3, 6)), cache.steel());
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(side * 0.3, -0.05, -1.0);
    tag(barrel, kit.id, kit.pickable);
    const muzzle = kit.glowMesh('turret-muzzle', () => new THREE.CylinderGeometry(0.12, 0.09, 0.14, 6), [side * 0.3, -0.05, -1.68], 2.4);
    muzzle.rotation.x = Math.PI / 2;
    head.add(barrel, muzzle);
  }
  head.add(dome, visor, kit.lamp('turret-lamp', [0, 0.36, 0.3], 0.12));
  spinners.push(head);
  group.add(head);
  return { group, spinners, column: visor, arm: head, pickable: kit.pickable, generationParts: [] };
}

/** Heavy Foundry: a broad armoured furnace hall with twin reactor stacks and a forge mouth. */
function buildFoundry(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  group.add(kit.box('foundry-floor', [5.1, 0.3, 4.1], cache.frame(team), [0, 0.15, 0], 0.05));
  group.add(kit.skirt('foundry-skirt', 4.4, 3.5, 1.0, cache.hull(team), [0, 0.8, 0]));
  group.add(kit.box('foundry-hall', [4.2, 1.5, 3.3], cache.hull(team), [0, 2.0, 0], 0.18));
  group.add(kit.box('foundry-deck', [3.7, 0.28, 2.85], cache.frame(team), [0, 2.86, 0], 0.12));
  group.add(kit.box('foundry-upper-plate', [2.7, 0.28, 2.1], cache.hull(team), [0, 3.08, 0], 0.12));
  for (const [index, x] of [-0.85, 0.85].entries()) {
    const z = -0.45;
    group.add(kit.drum(`foundry-stack-${index}`, 0.42, 0.5, 1.8, cache.plate(team), [x, 4.0, z], 8));
    group.add(kit.ringStrips('foundry-stack-strip', 0.44, 4.7, 0.3, 0.05, 8, 2.4, [x, 0, z]));
    group.add(kit.drum('foundry-stack-lip', 0.5, 0.5, 0.16, cache.hull(team), [x, 4.95, z], 8));
    group.add(kit.glowMesh('foundry-stack-top', () => new THREE.CylinderGeometry(0.29, 0.29, 0.12, 8), [x, 5.05, z], 1.2));
  }
  const mouth = kit.strip('foundry-mouth', [1.6, 1.0, 0.1], [0, 1.0, -2.05], 0, 1.6);
  group.add(mouth);
  group.add(kit.box('foundry-mouth-frame', [2.2, 1.4, 0.24], cache.hull(team), [0, 1.05, -1.95], 0.04, false));
  group.add(kit.box('foundry-stripe', [2.0, 0.12, 0.05], cache.hazard(), [0, 1.85, -1.98], 0.01, false));
  for (const side of [-1, 1]) {
    group.add(kit.box('foundry-wing', [0.8, 1.6, 1.6], cache.frame(team), [side * 2.15, 1.3, 0.6], 0.05));
    group.add(kit.strip('foundry-wing-strip', [0.08, 1.1, 0.08], [side * 2.58, 1.3, 0.6]));
    group.add(kit.lamp('foundry-lamp', [side * 2.15, 2.16, -0.1]));
  }
  const hammer = new THREE.Group();
  hammer.position.set(0, 2.6, -2.4);
  hammer.userData.restY = 2.6;
  const beam = kit.box('foundry-beam', [2.4, 0.22, 0.26], cache.steel(), [0, 0, 0], 0.03, false);
  const block = kit.box('foundry-hammer', [0.7, 0.9, 0.6], cache.plate(team), [0, -0.55, 0], 0.05, false);
  hammer.add(beam, block);
  group.add(hammer);
  return { group, spinners: [], column: mouth, arm: hammer, pickable: kit.pickable, generationParts: [] };
}

/** Habitat: a low hexagonal crew bunker with lit slot windows and a vent dome. */
function buildHabitat(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  group.add(kit.box('habitat-plinth', [3.1, 0.28, 3.0], cache.frame(team), [0, 0.14, 0], 0.1));
  group.add(kit.skirt('habitat-shell', 2.6, 2.5, 1.65, cache.hull(team), [0, 1.05, 0]));
  group.add(kit.box('habitat-roof', [2.35, 0.25, 2.25], cache.hull(team), [0, 1.98, 0], 0.12));
  group.add(kit.box('habitat-recess', [1.55, 0.15, 1.7], cache.frame(team), [0, 2.12, 0], 0.06));
  for (const side of [-1, 1]) {
    group.add(kit.box('habitat-rail', [0.28, 0.55, 2.35], cache.hull(team), [side * 1.0, 2.05, 0], 0.07));
    group.add(kit.box('habitat-foot', [0.5, 0.75, 0.8], cache.frame(team), [side * 1.25, 0.5, 1.1], 0.08));
    group.add(kit.strip('habitat-foot-light', [0.06, 0.3, 0.05], [side * 1.26, 0.6, 1.52], 0, 1.2));
  }
  group.add(kit.drum('habitat-extractor', 0.29, 0.4, 1.12, cache.plate(team), [-0.5, 2.68, -0.45], 8));
  group.add(kit.drum('habitat-extractor-cap', 0.4, 0.4, 0.14, cache.hull(team), [-0.5, 3.27, -0.45], 8));
  group.add(kit.box('habitat-front-door', [1.8, 1.12, 0.18], cache.frame(team), [0, 0.9, 1.31], 0.06));
  group.add(kit.box('habitat-front-hazard', [1.0, 0.1, 0.06], cache.hazard(), [0, 1.38, 1.43], 0.01));
  for (let slot = 0; slot < 3; slot++) group.add(kit.box('habitat-door-slat', [1.35, 0.1, 0.06], cache.plate(team), [0, 0.55 + slot * 0.22, 1.43], 0.02));
  group.add(kit.lamp('habitat-lamp', [0.3, 2.28, 0.2]));
  return { group, spinners: [], column: null, arm: null, pickable: kit.pickable, generationParts: [] };
}

/** Storage Depot: a low armoured vault beside a stack of striped cargo containers. */
function buildDepot(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  group.add(kit.box('depot-slab', [3.0, 0.26, 2.0], cache.frame(team), [0, 0.13, 0], 0.04));
  group.add(kit.box('depot-vault', [1.8, 1.2, 1.6], cache.hull(team), [-0.55, 0.85, 0], 0.08));
  group.add(kit.box('depot-vault-roof', [1.95, 0.2, 1.75], cache.hull(team), [-0.55, 1.5, 0], 0.04));
  group.add(kit.strip('depot-edge', [1.8, 0.06, 0.06], [-0.55, 1.62, -0.85]));
  group.add(kit.strip('depot-edge', [1.8, 0.06, 0.06], [-0.55, 1.62, 0.85]));
  const hatch = kit.strip('depot-hatch', [1.0, 0.6, 0.08], [-0.55, 0.75, -0.82], 0, 1.5);
  group.add(hatch);
  group.add(kit.lamp('depot-lamp', [0.2, 1.62, -0.6]));
  for (const [index, [x, y, z]] of ([[0.95, 0.5, -0.45], [0.95, 0.5, 0.35], [0.95, 1.0, -0.05]] as const).entries()) {
    group.add(kit.box(`depot-crate-${index % 2}`, [0.7, 0.5, 0.62], index === 1 ? cache.plate(team) : cache.frame(team), [x, y, z], 0.04));
    group.add(kit.box('depot-crate-stripe', [0.72, 0.08, 0.64], cache.hazard(), [x, y, z], 0.01, false));
  }
  return { group, spinners: [], column: hatch, arm: null, pickable: kit.pickable, generationParts: [] };
}

/** Gate: two armoured pylons and a lit lintel over a threshold that units walk straight through. */
function buildGate(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    group.add(kit.box('gate-post', [0.5, 2.3, 0.9], cache.hull(team), [side * 0.75, 1.15, 0], 0.05));
    group.add(kit.strip('gate-post-strip', [0.08, 1.6, 0.08], [side * 0.75, 1.15, -0.5]));
    group.add(kit.lamp('gate-lamp', [side * 0.75, 2.36, 0], 0.14));
  }
  group.add(kit.box('gate-lintel', [2.0, 0.4, 0.8], cache.hull(team), [0, 2.45, 0], 0.04));
  group.add(kit.strip('gate-lintel-strip', [1.0, 0.1, 0.1], [0, 2.45, -0.44], 0, 2.4));
  const threshold = kit.strip('gate-threshold', [1.0, 0.04, 0.6], [0, 0.05, 0], 0, 1.2);
  spinners.push(threshold);
  group.add(threshold);
  return { group, spinners, column: threshold, arm: null, pickable: kit.pickable, generationParts: [] };
}

/**
 * Reclamation Plant: an intake hopper, a crusher drum turning behind an open frame, and two
 * exhaust stacks. It reads as the colony eating something and pushing metal out the other side,
 * which is exactly what it does -- Energy in at the lit mouth, Matter out on the pad.
 */
function buildReclaimer(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  group.add(kit.box('reclaimer-pad', [3.1, 0.26, 3.1], cache.frame(team), [0, 0.13, 0], 0.05));
  group.add(kit.skirt('reclaimer-skirt', 2.4, 2.4, 0.7, cache.hull(team), [0, 0.6, 0.1]));
  group.add(kit.drum('reclaimer-body', 1.0, 1.15, 1.3, cache.hull(team), [0, 1.55, 0.1]));
  group.add(kit.ringStrips('reclaimer-body-strip', 1.05, 1.75, 0.7, 0.06, 8, 2.2, [0, 0, 0.1]));
  group.add(kit.drum('reclaimer-cap', 0.8, 1.05, 0.32, cache.plate(team), [0, 2.36, 0.1]));
  group.add(kit.ringStrips('reclaimer-cap-strip', 0.86, 2.5, 0.4, 0.06, 8, 2.6, [0, 0, 0.1]));
  // A lit vent on the near face: from the game's camera the machinery is on the far side.
  group.add(kit.strip('reclaimer-vent', [1.0, 0.3, 0.08], [0, 1.35, 1.28], 0, 2.0));

  // The crusher: a drum on a horizontal axis, framed so the turning face is visible from above.
  const crusher = kit.drum('reclaimer-crusher', 0.52, 0.52, 0.9, cache.steel(), [0, 1.5, -1.0], 6, false);
  crusher.rotation.x = Math.PI / 2;
  spinners.push(crusher);
  group.add(crusher);
  for (const side of [-1, 1]) {
    group.add(kit.box('reclaimer-yoke', [0.22, 1.5, 0.9], cache.frame(team), [side * 0.72, 1.2, -1.0], 0.04));
    group.add(kit.drum(`reclaimer-stack-${side > 0 ? 'a' : 'b'}`, 0.3, 0.36, 1.6, cache.plate(team), [side * 1.0, 2.35, 0.8], 6));
    group.add(kit.glowMesh('reclaimer-stack-top', () => new THREE.CylinderGeometry(0.24, 0.24, 0.12, 6), [side * 1.0, 3.2, 0.8], 2.4));
    group.add(kit.lamp('reclaimer-lamp', [side * 1.2, 0.95, -1.35]));
  }

  // The intake: a lit throat under a hazard-striped lintel, facing the same way as a Foundry mouth.
  const mouth = kit.strip('reclaimer-mouth', [1.1, 0.55, 0.1], [0, 0.72, -1.5], 0, 1.9);
  group.add(mouth);
  group.add(kit.box('reclaimer-mouth-frame', [1.5, 0.9, 0.22], cache.hull(team), [0, 0.75, -1.42], 0.04, false));
  group.add(kit.box('reclaimer-stripe', [1.4, 0.1, 0.05], cache.hazard(), [0, 1.28, -1.45], 0.01, false));

  // The ram that feeds it, driven by the same "working" animation as a Fabricator gantry.
  const ram = new THREE.Group();
  ram.position.set(0, 1.05, -1.85);
  ram.userData.restY = 1.05;
  ram.add(kit.box('reclaimer-ram-head', [0.9, 0.3, 0.4], cache.plate(team), [0, 0, 0], 0.04, false));
  ram.add(kit.box('reclaimer-ram-rod', [0.16, 0.16, 0.7], cache.steel(), [0, 0, 0.5], 0.03, false));
  group.add(ram);
  return { group, spinners, column: mouth, arm: ram, pickable: kit.pickable, generationParts: [] };
}

/**
 * Cognition Lab: a shielded column of lit data discs under a slow gyro ring. Where the Reclaimer
 * is heavy machinery, this one is quiet and instrument-like -- the place a colony thinks in.
 */
function buildDatalab(kit: Kit): BuildingModel {
  const { cache, team } = kit;
  const group = new THREE.Group();
  const spinners: THREE.Object3D[] = [];
  group.add(kit.box('datalab-pad', [3.1, 0.24, 3.1], cache.frame(team), [0, 0.12, 0], 0.05));
  group.add(kit.chassis('datalab-plinth', 1.35, 0.45));
  group.add(kit.drum('datalab-shell', 0.95, 1.2, 0.95, cache.hull(team), [0, 0.92, 0]));
  group.add(kit.podRing('datalab-buttress', 1.15, 0.8, 4, [0.34, 0.66, 0.3], [0, 0, 0], Math.PI / 4));

  // The stack the Data actually comes off, and the reason the shell stops low: three lit discs
  // spaced on an open spindle, in clear air where they read from the game's own camera angle.
  group.add(kit.drum('datalab-spindle', 0.2, 0.2, 1.5, cache.steel(), [0, 2.1, 0], 6, false));
  for (const [index, y] of [1.6, 2.05, 2.5].entries()) {
    group.add(kit.glowMesh(`datalab-disc-${index}`, () => new THREE.CylinderGeometry(0.7, 0.7, 0.07, 12), [0, y, 0], 1.5));
    group.add(kit.drum(`datalab-disc-rim-${index}`, 0.74, 0.74, 0.05, cache.plate(team), [0, y - 0.07, 0], 12, false));
  }
  group.add(kit.drum('datalab-collar', 0.5, 0.75, 0.2, cache.plate(team), [0, 2.72, 0], 8));

  const gyro = kit.glowMesh('datalab-gyro', () => new THREE.TorusGeometry(0.98, 0.05, 6, 20), [0, 2.05, 0], 1.8);
  gyro.rotation.x = Math.PI / 2.4;
  spinners.push(gyro);
  group.add(gyro);

  const spire = kit.strip('datalab-spire', [0.12, 0.9, 0.12], [0, 3.25, 0], 0, 2.2);
  group.add(spire);
  group.add(kit.antenna('datalab-antenna', [0.9, 1.4, -0.7], 0.9));
  for (const side of [-1, 1]) {
    group.add(kit.box('datalab-cowl', [0.5, 1.0, 0.5], cache.frame(team), [side * 1.15, 0.8, 1.0], 0.05));
    group.add(kit.lamp('datalab-lamp', [side * 1.15, 1.36, 1.0]));
  }
  return { group, spinners, column: spire, arm: null, pickable: kit.pickable, generationParts: [] };
}

/**
 * Every structure grows real mass at each Generation rather than wearing a badge: extra
 * storeys, armour, dishes, and crowns that change the silhouette from across the map.
 */
function generationUpgrades(kit: Kit, kind: BuildingTypeId): GenerationPart[] {
  const { cache, team } = kit;
  const parts: GenerationPart[] = [];
  const add = (min: 2 | 3, build: (tier: THREE.Group) => void): void => {
    const tier = new THREE.Group();
    tier.visible = false;
    build(tier);
    tier.traverse((object) => { object.castShadow = true; object.receiveShadow = true; });
    parts.push({ part: tier, min });
  };
  const box = (key: string, size: Vec3, material: THREE.Material, at: Vec3): THREE.Mesh => kit.box(key, size, material, at, 0.05, false);
  const drum = (key: string, top: number, bottom: number, height: number, material: THREE.Material, at: Vec3, sides = 8): THREE.Mesh => kit.drum(key, top, bottom, height, material, at, sides, false);
  const glow = (key: string, build: () => THREE.BufferGeometry, at: Vec3, intensity = 2.2): THREE.Mesh => kit.glowMesh(key, build, at, intensity);

  if (kind === 'core') {
    add(2, (tier) => {
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI / 2;
        tier.add(drum('core-g2-pylon', 0.18, 0.24, 3.2, cache.steel(), [Math.cos(angle) * 3.0, 1.8, Math.sin(angle) * 3.0], 6));
        tier.add(glow('core-g2-lamp', () => new THREE.OctahedronGeometry(0.2, 0), [Math.cos(angle) * 3.0, 3.6, Math.sin(angle) * 3.0]));
      }
      tier.add(kit.ringStrips('core-g2-strip', 2.6, 1.55, 1.9, 0.06, 8, 2.4));
    });
    add(3, (tier) => {
      const spire = new THREE.Mesh(cache.geometry('core-g3-spire', () => new THREE.ConeGeometry(0.5, 2.6, 8)), cache.plate(team));
      spire.position.y = 9.8;
      tier.add(spire, drum('core-g3-collar', 0.8, 1.1, 0.5, cache.frame(team), [0, 8.6, 0]));
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2;
        tier.add(glow('core-g3-shard', () => new THREE.OctahedronGeometry(0.4, 0), [Math.cos(angle) * 2.6, 8.4, Math.sin(angle) * 2.6], 2.6));
      }
    });
  } else if (kind === 'relay') {
    add(2, (tier) => {
      const dish = new THREE.Mesh(cache.geometry('relay-g2-dish', () => new THREE.ConeGeometry(0.5, 0.32, 8, 1, true)), cache.steel());
      dish.rotation.set(Math.PI * 0.72, 0, -0.4); dish.position.set(-0.6, 3.2, 0.5);
      tier.add(dish, box('relay-g2-boom', [0.1, 0.1, 0.9], cache.steel(), [-0.3, 3.1, 0.3]));
      tier.add(drum('relay-g2-collar', 1.05, 1.15, 0.3, cache.plate(team), [0, 1.7, 0]));
      tier.add(kit.ringStrips('relay-g2-strip', 1.08, 1.7, 0.6, 0.06));
    });
    add(3, (tier) => {
      const ring = glow('relay-g3-ring', () => new THREE.TorusGeometry(1.1, 0.06, 6, 22), [0, 4.9, 0]);
      ring.rotation.set(Math.PI / 2, 0, 0.3);
      tier.add(ring, drum('relay-g3-mast', 0.08, 0.1, 1.6, cache.plate(team), [0, 5.3, 0], 6));
      tier.add(glow('relay-g3-beacon', () => new THREE.OctahedronGeometry(0.3, 0), [0, 6.3, 0], 2.8));
    });
  } else if (kind === 'fabricator') {
    add(2, (tier) => {
      tier.add(box('fab-g2-storey', [2.0, 0.9, 1.5], cache.hull(team), [0.5, 3.0, -0.2]));
      tier.add(box('fab-g2-storey-roof', [2.15, 0.16, 1.65], cache.frame(team), [0.5, 3.5, -0.2]));
      tier.add(kit.strip('fab-g2-window', [1.4, 0.24, 0.08], [0.5, 3.0, -1.0], 0, 1.5));
      tier.add(drum('fab-g2-silo', 0.5, 0.58, 2.2, cache.plate(team), [2.0, 1.1, -0.7]));
      tier.add(kit.ringStrips('fab-g2-silo-strip', 0.52, 1.9, 0.36, 0.05, 8, 2.2, [2.0, 0, -0.7]));
    });
    add(3, (tier) => {
      tier.add(glow('fab-g3-dome', () => new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0.5, 3.55, -0.2], 1.4));
      tier.add(box('fab-g3-gantry', [4.2, 0.16, 0.24], cache.steel(), [0, 4.6, -1.0]));
      tier.add(box('fab-g3-hook', [0.26, 0.5, 0.26], cache.plate(team), [1.1, 4.25, -1.0]));
      for (const side of [-1, 1]) tier.add(drum('fab-g3-leg', 0.1, 0.14, 1.9, cache.steel(), [side * 2.0, 3.65, -1.0], 6));
    });
  } else if (kind === 'habitat') {
    add(2, (tier) => {
      tier.add(drum('habitat-g2-storey', 0.85, 1.0, 0.9, cache.hull(team), [0, 2.5, 0], 6));
      tier.add(kit.ringStrips('habitat-g2-strip', 0.92, 2.7, 0.6, 0.06, 6, 1.8));
      tier.add(drum('habitat-g2-roof', 0.6, 0.9, 0.3, cache.plate(team), [0, 3.1, 0], 6));
    });
    add(3, (tier) => {
      tier.add(glow('habitat-g3-dome', () => new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 3.25, 0], 1.2));
      tier.add(drum('habitat-g3-antenna', 0.04, 0.05, 1.2, cache.steel(), [0.7, 3.2, 0.5], 5));
      tier.add(glow('habitat-g3-bulb', () => new THREE.OctahedronGeometry(0.16, 0), [0.7, 3.9, 0.5], 2.6));
    });
  } else if (kind === 'depot') {
    add(2, (tier) => {
      tier.add(drum('depot-g2-silo', 0.5, 0.56, 2.0, cache.hull(team), [-1.35, 1.0, 0.55]));
      tier.add(drum('depot-g2-cap', 0.56, 0.44, 0.3, cache.plate(team), [-1.35, 2.15, 0.55]));
      tier.add(kit.ringStrips('depot-g2-strip', 0.52, 1.8, 0.36, 0.05, 8, 2.2, [-1.35, 0, 0.55]));
    });
    add(3, (tier) => {
      tier.add(box('depot-g3-jib', [2.4, 0.14, 0.18], cache.steel(), [0.3, 2.9, -0.2]));
      tier.add(drum('depot-g3-post', 0.09, 0.11, 2.6, cache.steel(), [1.4, 1.6, -0.2], 6));
      tier.add(glow('depot-g3-load', () => new THREE.BoxGeometry(0.4, 0.44, 0.4), [-0.6, 2.4, -0.2], 1.6));
    });
  } else if (kind === 'wall') {
    add(2, (tier) => {
      tier.add(box('wall-g2-cap', [4.0, 0.5, 0.9], cache.hull(team), [0, 2.3, 0]));
      tier.add(kit.strip('wall-g2-strip', [3.8, 0.06, 0.06], [0, 2.58, -0.46]));
      tier.add(kit.strip('wall-g2-strip', [3.8, 0.06, 0.06], [0, 2.58, 0.46]));
    });
    add(3, (tier) => {
      for (const side of [-1, 1]) {
        tier.add(drum('wall-g3-emitter', 0.09, 0.12, 0.8, cache.steel(), [side * 1.8, 2.95, 0], 6));
        tier.add(glow('wall-g3-node', () => new THREE.OctahedronGeometry(0.15, 0), [side * 1.8, 3.4, 0], 2.6));
      }
      tier.add(glow('wall-g3-curtain', () => new THREE.BoxGeometry(3.4, 0.5, 0.06), [0, 3.3, 0], 1.1));
    });
  } else if (kind === 'gate') {
    add(2, (tier) => {
      tier.add(box('gate-g2-arch', [2.3, 0.3, 0.95], cache.hull(team), [0, 2.85, 0]));
      for (const side of [-1, 1]) tier.add(box('gate-g2-buttress', [0.3, 1.4, 1.0], cache.frame(team), [side * 1.1, 0.75, 0]));
      tier.add(kit.strip('gate-g2-strip', [2.1, 0.06, 0.06], [0, 3.02, -0.48]));
    });
    add(3, (tier) => {
      tier.add(glow('gate-g3-curtain', () => new THREE.BoxGeometry(1.0, 1.9, 0.05), [0, 1.15, 0], 1.0));
      tier.add(glow('gate-g3-crest', () => new THREE.OctahedronGeometry(0.26, 0), [0, 3.35, 0], 2.6));
    });
  } else if (kind === 'outpost') {
    add(2, (tier) => {
      tier.add(drum('outpost-g2-skirt', 1.9, 2.05, 0.3, cache.frame(team), [0, 0.45, 0]));
      tier.add(kit.ringStrips('outpost-g2-strip', 1.95, 0.5, 1.3, 0.06));
      const dish = new THREE.Mesh(cache.geometry('outpost-g2-dish', () => new THREE.ConeGeometry(0.5, 0.32, 8, 1, true)), cache.steel());
      dish.rotation.set(Math.PI * 0.7, 0, 0.3); dish.position.set(0.9, 4.4, 0);
      tier.add(dish, box('outpost-g2-boom', [0.9, 0.1, 0.1], cache.steel(), [0.5, 4.2, 0]));
    });
    add(3, (tier) => {
      tier.add(glow('outpost-g3-shield', () => new THREE.SphereGeometry(1.9, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.5, 0], 0.7));
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2;
        tier.add(glow('outpost-g3-pod', () => new THREE.OctahedronGeometry(0.24, 0), [Math.cos(angle) * 1.9, 4.6, Math.sin(angle) * 1.9], 2.4));
      }
    });
  } else if (kind === 'turret') {
    add(2, (tier) => {
      for (const side of [-1, 1]) {
        tier.add(box('turret-g2-pod', [0.34, 0.36, 0.6], cache.plate(team), [side * 0.8, 1.95, 0.2]));
        const gun = drum('turret-g2-gun', 0.06, 0.08, 0.9, cache.steel(), [side * 0.8, 1.95, -0.55], 6);
        gun.rotation.set(Math.PI / 2, 0, 0);
        tier.add(gun);
      }
      tier.add(drum('turret-g2-ring', 1.1, 1.15, 0.2, cache.plate(team), [0, 0.5, 0], 6));
    });
    add(3, (tier) => {
      const cannon = drum('turret-g3-cannon', 0.18, 0.24, 1.8, cache.steel(), [0, 2.5, -1.0]);
      cannon.rotation.set(Math.PI / 2, 0, 0);
      tier.add(cannon, box('turret-g3-pack', [1.0, 0.6, 0.7], cache.hull(team), [0, 2.55, 0.8]));
      tier.add(glow('turret-g3-muzzle', () => new THREE.OctahedronGeometry(0.22, 0), [0, 2.5, -1.95], 3));
    });
  } else {
    add(2, (tier) => {
      tier.add(drum('foundry-g2-storey', 1.3, 1.6, 1.0, cache.hull(team), [0, 3.65, 0]));
      tier.add(kit.ringStrips('foundry-g2-strip', 1.32, 4.0, 0.9, 0.06));
      tier.add(drum('foundry-g2-deck', 1.0, 1.3, 0.3, cache.frame(team), [0, 4.3, 0]));
    });
    add(3, (tier) => {
      tier.add(glow('foundry-g3-crucible', () => new THREE.SphereGeometry(0.7, 10, 7), [0, 5.7, 0], 2.2));
      tier.add(drum('foundry-g3-frame', 0.9, 1.05, 0.3, cache.steel(), [0, 4.95, 0]));
      for (const side of [-1, 1]) tier.add(box('foundry-g3-fin', [0.2, 1.8, 1.0], cache.plate(team), [side * 1.9, 4.2, 0]));
    });
  }
  return parts;
}

/**
 * Collapses a finished structure's static meshes into one mesh per material.
 *
 * A structure is assembled from thirty-odd small pieces -- drums, strips, pods, lamps -- and every
 * one of them was its own draw call: measured, 34 per building, so a colony of forty structures
 * asked the GPU for well over a thousand before a single Agent moved, and a player building a city
 * watched their frame rate fall as they built it. The pieces never move relative to each other, so
 * they can be baked into a handful of merged geometries; anything the renderer animates (spinners,
 * the emissive column, the working arm, Generation tiers) is left exactly where it was.
 *
 * The merged geometry depends only on the kind and the team, so it is cached and shared by every
 * structure of that kind -- the same trick that already makes a hundred-Agent battle cheap.
 */
function mergeStatic(model: BuildingModel, cache: ResourceCache, kind: BuildingTypeId, team: Team, id: string): BuildingModel {
  const animated = new Set<THREE.Object3D>();
  for (const part of [...model.spinners, model.column, model.arm, ...model.generationParts.map((entry) => entry.part)]) {
    part?.traverse((object) => animated.add(object));
  }

  const buckets = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
  model.group.updateMatrixWorld(true);
  model.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || animated.has(object)) return;
    // A mesh under an animated parent moves with it and must not be baked into the hull.
    for (let parent = object.parent; parent; parent = parent.parent) if (animated.has(parent)) return;
    const material = object.material as THREE.Material;
    const bucket = buckets.get(material.uuid) ?? { material, meshes: [] };
    bucket.meshes.push(object);
    buckets.set(material.uuid, bucket);
  });

  const pickable: THREE.Object3D[] = model.pickable.filter((object) => animated.has(object));
  for (const [key, bucket] of buckets) {
    if (bucket.meshes.length === 0) continue;
    const wasPickable = bucket.meshes.some((mesh) => model.pickable.includes(mesh));
    for (const mesh of bucket.meshes) mesh.removeFromParent();
    if (bucket.meshes.length === 1) {
      // Nothing to merge with: keep the original rather than pay to rebuild it.
      const only = bucket.meshes[0]!;
      model.group.attach(only);
      if (wasPickable) pickable.push(only);
      continue;
    }
    const geometry = cache.geometry(`merged-${kind}-${team}-${key}`, () => {
      const parts = bucket.meshes.map((mesh) => {
        const clone = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        clone.applyMatrix4(mesh.matrixWorld);
        // Merging demands identical attribute sets; nothing here is skinned or morphed.
        for (const name of Object.keys(clone.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') clone.deleteAttribute(name);
        }
        return clone;
      });
      const merged = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      if (!merged) throw new Error(`Could not merge ${kind} geometry`);
      return merged;
    });
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.entityId = id;
    model.group.add(mesh);
    if (wasPickable) pickable.push(mesh);
  }
  return { ...model, pickable };
}

export function buildBuildingModel(cache: ResourceCache, kind: BuildingTypeId, team: Team, id: string): BuildingModel {
  const kit = new Kit(cache, team, id);
  const model = kind === 'core' ? buildCore(kit)
    : kind === 'relay' ? buildRelay(kit)
      : kind === 'fabricator' ? buildFabricator(kit)
        : kind === 'habitat' ? buildHabitat(kit)
          : kind === 'depot' ? buildDepot(kit)
            : kind === 'wall' ? buildWall(kit)
              : kind === 'gate' ? buildGate(kit)
                : kind === 'outpost' ? buildOutpost(kit)
                  : kind === 'turret' ? buildTurret(kit)
                    : kind === 'reclaimer' ? buildReclaimer(kit)
                      : kind === 'datalab' ? buildDatalab(kit)
                        : buildFoundry(kit);
  const upgrades = generationUpgrades(kit, kind);
  if (['fabricator', 'foundry', 'depot', 'reclaimer', 'datalab'].includes(kind)) {
    const [width, depth] = BUILDINGS[kind].footprint;
    for (const side of [-1, 1]) {
      const brace = kit.box(`${kind}-front-brace`, [0.38, 1.6, 0.5], cache.frame(team), [side * (width / 2 - 0.3), 1.0, depth / 2 - 0.1], 0.08);
      model.group.add(brace);
      model.group.add(kit.box(`${kind}-brace-plate`, [0.42, 0.6, 0.2], cache.hull(team), [side * (width / 2 - 0.3), 1.55, depth / 2 + 0.16], 0.06));
      model.group.add(kit.strip(`${kind}-brace-optic`, [0.06, 0.62, 0.04], [side * (width / 2 - 0.3), 0.95, depth / 2 + 0.18], 0, 1.2));
    }
    model.group.add(kit.box(`${kind}-service-panel`, [width * 0.55, 0.96, 0.16], cache.frame(team), [0, 0.86, depth / 2 + 0.02], 0.08));
    for (let slot = 0; slot < 4; slot++) model.group.add(kit.box(`${kind}-vent-slat`, [width * 0.44, 0.08, 0.06], cache.plate(team), [0, 0.55 + slot * 0.19, depth / 2 + 0.12], 0.01));
    model.group.add(kit.box(`${kind}-service-warning`, [width * 0.35, 0.09, 0.06], cache.hazard(), [0, 1.43, depth / 2 + 0.13], 0.01));
  }
  detailBuilding(model.group, kind, cache, team, id);
  model.group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.entityId === id && !kit.pickable.includes(object)) kit.pickable.push(object);
  });
  for (const entry of upgrades) model.group.add(entry.part);
  applyMachineryMaterials(model.group, cache, team);
  return mergeStatic({ ...model, generationParts: [...model.generationParts, ...upgrades] }, cache, kind, team, id);
}

/** Scaffolding shown while a site is still being assembled: corner posts and a lit top beam. */
export function buildConstructionScaffold(cache: ResourceCache, kind: BuildingTypeId, team: Team): THREE.Group {
  const group = new THREE.Group();
  const config = BUILDINGS[kind];
  const [width, depth] = config.footprint;
  const post = cache.geometry('scaffold-post', () => new THREE.BoxGeometry(0.14, 1.4, 0.14));
  const steel = cache.steel();
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pillar = new THREE.Mesh(post, steel);
    pillar.position.set((dx * width) / 2 - dx * 0.2, 0.7, (dz * depth) / 2 - dz * 0.2);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const beam = new THREE.Mesh(cache.geometry(`scaffold-beam-${width}`, () => new THREE.BoxGeometry(width, 0.08, 0.08)), cache.glow(team, 1.6));
  beam.position.set(0, 1.4, -depth / 2 + 0.2);
  group.add(beam);
  return group;
}
