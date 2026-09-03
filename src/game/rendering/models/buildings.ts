import * as THREE from 'three';
import { BUILDINGS } from '../../../data/buildings';
import type { BuildingTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import type { ResourceCache } from './palette';

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

/** Core: a tiered ziggurat with an energy column and two counter-rotating orbit rings. */
function buildCore(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];

  const base = new THREE.Mesh(cache.geometry('core-base', () => new THREE.CylinderGeometry(2.5, 2.9, 0.7, 8)), cache.frame(team));
  base.position.y = 0.35;
  tag(base, id, pickable);

  const tier = new THREE.Mesh(cache.geometry('core-tier', () => new THREE.CylinderGeometry(1.9, 2.4, 0.9, 8)), cache.plate(team));
  tier.position.y = 1.05;
  tag(tier, id, pickable);

  const drum = new THREE.Mesh(cache.geometry('core-drum', () => new THREE.CylinderGeometry(1.3, 1.7, 1.5, 8)), cache.hull(team));
  drum.position.y = 2.15;
  tag(drum, id, pickable);

  const cap = new THREE.Mesh(cache.geometry('core-cap', () => new THREE.CylinderGeometry(1.05, 1.3, 0.4, 8)), cache.plate(team));
  cap.position.y = 3.05;
  tag(cap, id, pickable);

  const column = new THREE.Mesh(cache.geometry('core-column', () => new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8)), cache.glow(team, 2.4));
  column.position.y = 3.6;

  const crown = new THREE.Mesh(cache.geometry('core-crown', () => new THREE.OctahedronGeometry(0.9, 0)), cache.glow(team, 1.4));
  crown.position.y = 5.1;
  tag(crown, id, pickable);

  for (const [index, radius] of [1.9, 2.4].entries()) {
    const ring = new THREE.Mesh(
      cache.geometry(`core-ring-${index}`, () => new THREE.TorusGeometry(radius, 0.07, 6, 28)),
      cache.glow(team, 1.1),
    );
    ring.position.y = 3.4 + index * 0.5;
    ring.rotation.x = Math.PI / 2 + (index === 0 ? 0.24 : -0.18);
    group.add(ring);
    spinners.push(ring);
  }

  // Four buttresses give the silhouette weight from any camera angle.
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
    const buttress = new THREE.Mesh(cache.geometry('core-buttress', () => new THREE.BoxGeometry(0.4, 1.8, 0.9)), cache.frame(team));
    buttress.position.set(Math.cos(angle) * 2.1, 0.9, Math.sin(angle) * 2.1);
    buttress.rotation.y = -angle;
    tag(buttress, id, pickable);
    group.add(buttress);
  }

  group.add(base, tier, drum, cap, column, crown);
  const autonomyCrown = new THREE.Mesh(cache.geometry('core-autonomy-crown', () => new THREE.TorusGeometry(1.15, 0.13, 6, 12)), cache.glow(team, 1.4));
  autonomyCrown.position.y = 4.65;
  autonomyCrown.rotation.x = Math.PI / 2;
  autonomyCrown.visible = false;
  const singularityHalo = new THREE.Mesh(cache.geometry('core-singularity-halo', () => new THREE.TorusGeometry(1.65, 0.1, 6, 18)), cache.glow(team, 2));
  singularityHalo.position.y = 5.1;
  singularityHalo.rotation.x = Math.PI / 2;
  singularityHalo.visible = false;
  group.add(autonomyCrown, singularityHalo);
  spinners.push(autonomyCrown, singularityHalo);
  return { group, spinners, column, arm: null, pickable, generationParts: [{ part: autonomyCrown, min: 2 }, { part: singularityHalo, min: 3 }] };
}

/** Relay Node: a mast with a rotating dish and a pulsing signal column. */
function buildRelay(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];

  const pad = new THREE.Mesh(cache.geometry('relay-pad', () => new THREE.CylinderGeometry(1, 1.2, 0.4, 6)), cache.frame(team));
  pad.position.y = 0.2;
  tag(pad, id, pickable);

  const housing = new THREE.Mesh(cache.geometry('relay-housing', () => new THREE.BoxGeometry(0.9, 0.7, 0.9)), cache.plate(team));
  housing.position.y = 0.72;
  tag(housing, id, pickable);

  const mast = new THREE.Mesh(cache.geometry('relay-mast', () => new THREE.CylinderGeometry(0.14, 0.22, 2.5, 6)), cache.hull(team));
  mast.position.y = 2.1;
  tag(mast, id, pickable);

  const dishMount = new THREE.Group();
  dishMount.position.y = 3.2;
  const dish = new THREE.Mesh(cache.geometry('relay-dish', () => new THREE.ConeGeometry(0.78, 0.5, 8, 1, true)), cache.hull(team));
  dish.rotation.set(Math.PI * 0.72, 0, 0.3);
  const feed = new THREE.Mesh(cache.geometry('relay-feed', () => new THREE.SphereGeometry(0.13, 6, 5)), cache.glow(team, 2));
  feed.position.set(0, 0.34, -0.3);
  dishMount.add(dish, feed);
  tag(dish, id, pickable);
  spinners.push(dishMount);

  const column = new THREE.Mesh(cache.geometry('relay-column', () => new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6)), cache.glow(team, 1.6));
  column.position.y = 2;

  group.add(pad, housing, mast, dishMount, column);
  return { group, spinners, column, arm: null, pickable, generationParts: [] };
}

/** Fabricator: an assembly hall with a gantry arm that sweeps while production runs. */
function buildFabricator(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];

  const floor = new THREE.Mesh(cache.geometry('fab-floor', () => new THREE.BoxGeometry(3.7, 0.3, 2.7)), cache.frame(team));
  floor.position.y = 0.15;
  tag(floor, id, pickable);

  const hall = new THREE.Mesh(cache.geometry('fab-hall', () => new THREE.BoxGeometry(3.2, 1.5, 2.2)), cache.plate(team));
  hall.position.y = 1;
  tag(hall, id, pickable);

  const roof = new THREE.Mesh(cache.geometry('fab-roof', () => new THREE.CylinderGeometry(1.15, 1.15, 3.1, 6, 1, false, 0, Math.PI)), cache.hull(team));
  roof.rotation.set(0, 0, Math.PI / 2);
  roof.position.y = 1.75;
  tag(roof, id, pickable);

  const vent = new THREE.Mesh(cache.geometry('fab-vent', () => new THREE.CylinderGeometry(0.36, 0.46, 1.1, 6)), cache.frame(team));
  vent.position.set(-1.3, 2.3, 0.6);
  tag(vent, id, pickable);

  const door = new THREE.Mesh(cache.geometry('fab-door', () => new THREE.BoxGeometry(1.5, 1, 0.12)), cache.glow(team, 1.1));
  door.position.set(0, 0.8, -1.14);

  // Gantry arm sweeps across the assembly bay whenever something is being built.
  const arm = new THREE.Group();
  arm.position.set(0, 2.1, 0);
  const rail = new THREE.Mesh(cache.geometry('fab-rail', () => new THREE.BoxGeometry(3.4, 0.14, 0.16)), cache.frame(team));
  const hoist = new THREE.Mesh(cache.geometry('fab-hoist', () => new THREE.BoxGeometry(0.34, 0.5, 0.34)), cache.plate(team));
  hoist.position.y = -0.32;
  const spark = new THREE.Mesh(cache.geometry('fab-spark', () => new THREE.SphereGeometry(0.12, 6, 5)), cache.glow(team, 2.6));
  spark.position.y = -0.62;
  arm.add(rail, hoist, spark);

  group.add(floor, hall, roof, vent, door, arm);
  return { group, spinners: [], column: null, arm, pickable, generationParts: [] };
}

/** Barrier Wall: chunky toy-like cover with glowing status pips. */
function buildWall(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const base = new THREE.Mesh(cache.geometry('wall-base', () => new THREE.BoxGeometry(1.9, 0.35, 0.9)), cache.frame(team));
  base.position.y = 0.18; tag(base, id, pickable);
  const slab = new THREE.Mesh(cache.geometry('wall-slab', () => new THREE.BoxGeometry(1.7, 1.25, 0.55)), cache.hull(team));
  slab.position.y = 0.9; tag(slab, id, pickable);
  for (const x of [-0.58, 0, 0.58]) {
    const pip = new THREE.Mesh(cache.geometry('wall-pip', () => new THREE.SphereGeometry(0.11, 6, 4)), cache.glow(team, 1.5));
    pip.position.set(x, 1.42, -0.3); group.add(pip);
  }
  group.add(base, slab);
  return { group, spinners: [], column: null, arm: null, pickable, generationParts: [] };
}

/** Field Outpost: a cheerful rover garage with a lookout eye and resource hatch. */
function buildOutpost(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = []; const spinners: THREE.Object3D[] = [];
  const base = new THREE.Mesh(cache.geometry('outpost-base', () => new THREE.CylinderGeometry(1.55, 1.75, 0.45, 8)), cache.frame(team));
  base.position.y = 0.22; tag(base, id, pickable);
  const cabin = new THREE.Mesh(cache.geometry('outpost-cabin', () => new THREE.CylinderGeometry(1.1, 1.35, 1.6, 8)), cache.hull(team));
  cabin.position.y = 1.15; tag(cabin, id, pickable);
  const visor = new THREE.Mesh(cache.geometry('outpost-visor', () => new THREE.BoxGeometry(1.15, 0.3, 0.12)), cache.glow(team, 1.5));
  visor.position.set(0, 1.42, -1.04);
  const mast = new THREE.Mesh(cache.geometry('outpost-mast', () => new THREE.CylinderGeometry(0.1, 0.14, 1.25, 6)), cache.frame(team));
  mast.position.y = 2.55; tag(mast, id, pickable);
  const eye = new THREE.Mesh(cache.geometry('outpost-eye', () => new THREE.SphereGeometry(0.3, 8, 6)), cache.glow(team, 2));
  eye.position.y = 3.15; tag(eye, id, pickable); spinners.push(eye);
  group.add(base, cabin, visor, mast, eye);
  return { group, spinners, column: eye, arm: null, pickable, generationParts: [] };
}

/** Zap Turret: oversized swivelling head and twin antenna ears for a playful silhouette. */
function buildTurret(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = []; const spinners: THREE.Object3D[] = [];
  const foot = new THREE.Mesh(cache.geometry('turret-foot', () => new THREE.CylinderGeometry(1, 1.2, 0.55, 8)), cache.frame(team));
  foot.position.y = 0.28; tag(foot, id, pickable);
  const neck = new THREE.Mesh(cache.geometry('turret-neck', () => new THREE.CylinderGeometry(0.34, 0.5, 1.25, 7)), cache.plate(team));
  neck.position.y = 1.12; tag(neck, id, pickable);
  const head = new THREE.Group(); head.position.y = 2;
  const dome = new THREE.Mesh(cache.geometry('turret-dome', () => new THREE.SphereGeometry(0.72, 8, 6)), cache.hull(team)); tag(dome, id, pickable);
  const eye = new THREE.Mesh(cache.geometry('turret-eye', () => new THREE.BoxGeometry(0.7, 0.2, 0.12)), cache.glow(team, 2.3)); eye.position.z = -0.66;
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(cache.geometry('turret-ear', () => new THREE.ConeGeometry(0.16, 0.65, 5)), cache.plate(team));
    ear.position.set(side * 0.48, 0.62, 0); ear.rotation.z = side * -0.28; head.add(ear);
  }
  const barrel = new THREE.Mesh(cache.geometry('turret-gun', () => new THREE.CylinderGeometry(0.12, 0.16, 1.3, 6)), cache.frame(team));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -1.05); tag(barrel, id, pickable);
  head.add(dome, eye, barrel); spinners.push(head); group.add(foot, neck, head);
  return { group, spinners, column: eye, arm: head, pickable, generationParts: [] };
}

/** Heavy Foundry: broad furnace hall with smokeless energy stacks and a stamping hammer. */
function buildFoundry(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const floor = new THREE.Mesh(cache.geometry('foundry-floor', () => new THREE.BoxGeometry(4.8, 0.4, 3.8)), cache.frame(team));
  floor.position.y = 0.2; tag(floor, id, pickable);
  const hall = new THREE.Mesh(cache.geometry('foundry-hall', () => new THREE.BoxGeometry(3.9, 2.2, 3.1)), cache.hull(team));
  hall.position.y = 1.45; tag(hall, id, pickable);
  const mouth = new THREE.Mesh(cache.geometry('foundry-mouth', () => new THREE.BoxGeometry(2.2, 1.35, 0.16)), cache.glow(team, 1.45));
  mouth.position.set(0, 1.15, -1.62);
  for (const side of [-1, 1]) {
    const stack = new THREE.Mesh(cache.geometry('foundry-stack', () => new THREE.CylinderGeometry(0.32, 0.48, 2.5, 7)), cache.plate(team));
    stack.position.set(side * 1.45, 3.05, 0.65); tag(stack, id, pickable); group.add(stack);
  }
  const hammer = new THREE.Group(); hammer.position.set(0, 3, 0);
  const beam = new THREE.Mesh(cache.geometry('foundry-beam', () => new THREE.BoxGeometry(3.8, 0.3, 0.35)), cache.frame(team));
  const block = new THREE.Mesh(cache.geometry('foundry-hammer', () => new THREE.BoxGeometry(0.8, 1.25, 0.8)), cache.plate(team)); block.position.y = -0.65;
  hammer.add(beam, block); group.add(floor, hall, mouth, hammer);
  return { group, spinners: [], column: mouth, arm: hammer, pickable, generationParts: [] };
}

/** Habitat: a stubby domed home block with lit windows and a little chimney. */
function buildHabitat(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const plinth = new THREE.Mesh(cache.geometry('habitat-plinth', () => new THREE.BoxGeometry(2.6, 0.3, 2.6)), cache.frame(team));
  plinth.position.y = 0.15; tag(plinth, id, pickable);
  const shell = new THREE.Mesh(cache.geometry('habitat-shell', () => new THREE.CylinderGeometry(1.15, 1.32, 1.5, 8)), cache.plate(team));
  shell.position.y = 1.05; tag(shell, id, pickable);
  const roof = new THREE.Mesh(cache.geometry('habitat-roof', () => new THREE.SphereGeometry(1.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), cache.hull(team));
  roof.position.y = 1.78; tag(roof, id, pickable);
  const flue = new THREE.Mesh(cache.geometry('habitat-flue', () => new THREE.CylinderGeometry(0.16, 0.2, 0.8, 6)), cache.frame(team));
  flue.position.set(0.62, 2.25, 0.42); tag(flue, id, pickable);
  // Lit windows are what make a colony read as inhabited rather than industrial.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const window = new THREE.Mesh(cache.geometry('habitat-window', () => new THREE.BoxGeometry(0.52, 0.42, 0.1)), cache.glow(team, 1.5));
    window.position.set(Math.sin(angle) * 1.22, 1.1, Math.cos(angle) * 1.22);
    window.rotation.y = angle; group.add(window);
  }
  group.add(plinth, shell, roof, flue);
  return { group, spinners: [], column: null, arm: null, pickable, generationParts: [] };
}

/** Storage Depot: an open-sided cargo shed with stacked crates and a deposit hatch. */
function buildDepot(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const slab = new THREE.Mesh(cache.geometry('depot-slab', () => new THREE.BoxGeometry(2.8, 0.28, 1.8)), cache.frame(team));
  slab.position.y = 0.14; tag(slab, id, pickable);
  const shed = new THREE.Mesh(cache.geometry('depot-shed', () => new THREE.BoxGeometry(2.3, 1.15, 1.4)), cache.hull(team));
  shed.position.y = 0.85; tag(shed, id, pickable);
  const canopy = new THREE.Mesh(cache.geometry('depot-canopy', () => new THREE.CylinderGeometry(0.95, 0.95, 2.5, 6, 1, false, 0, Math.PI)), cache.plate(team));
  canopy.rotation.z = Math.PI / 2; canopy.position.y = 1.5; tag(canopy, id, pickable);
  const hatch = new THREE.Mesh(cache.geometry('depot-hatch', () => new THREE.BoxGeometry(1.1, 0.62, 0.1)), cache.glow(team, 1.4));
  hatch.position.set(0, 0.72, -0.74);
  for (const [index, offset] of [-0.75, 0.05, 0.85].entries()) {
    const crate = new THREE.Mesh(cache.geometry(`depot-crate-${index % 2}`, () => new THREE.BoxGeometry(0.5 + (index % 2) * 0.12, 0.45, 0.5)), cache.plate(team));
    crate.position.set(offset, 0.5, 1.05); crate.rotation.y = index * 0.4; tag(crate, id, pickable); group.add(crate);
  }
  group.add(slab, shed, canopy, hatch);
  return { group, spinners: [], column: hatch, arm: null, pickable, generationParts: [] };
}

/** Gate: a wall-height doorway that units walk straight through. */
function buildGate(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = []; const spinners: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(cache.geometry('gate-post', () => new THREE.BoxGeometry(0.45, 1.8, 0.75)), cache.frame(team));
    post.position.set(side * 0.72, 0.9, 0); tag(post, id, pickable); group.add(post);
    const lamp = new THREE.Mesh(cache.geometry('gate-lamp', () => new THREE.SphereGeometry(0.15, 6, 5)), cache.glow(team, 2.2));
    lamp.position.set(side * 0.72, 1.95, 0); group.add(lamp);
  }
  const lintel = new THREE.Mesh(cache.geometry('gate-lintel', () => new THREE.BoxGeometry(1.95, 0.4, 0.6)), cache.plate(team));
  lintel.position.y = 2.05; tag(lintel, id, pickable);
  // The threshold glows but never blocks: a Gate is the hole you leave in your own wall.
  const threshold = new THREE.Mesh(cache.geometry('gate-threshold', () => new THREE.BoxGeometry(1.05, 0.06, 0.5)), cache.glow(team, 1.2));
  threshold.position.y = 0.07; spinners.push(threshold);
  group.add(lintel, threshold);
  return { group, spinners, column: threshold, arm: null, pickable, generationParts: [] };
}

/**
 * Every structure grows real mass at each Generation rather than wearing a badge: extra
 * storeys, armour, dishes, and crowns that change the silhouette from across the map.
 */
function generationUpgrades(cache: ResourceCache, kind: BuildingTypeId, team: Team): GenerationPart[] {
  const parts: GenerationPart[] = [];
  const add = (min: 2 | 3, build: (tier: THREE.Group) => void): void => {
    const tier = new THREE.Group();
    tier.visible = false;
    build(tier);
    // Upgrades are structure, not decals: they cast and catch light like the rest of the hull.
    tier.traverse((object) => { object.castShadow = true; object.receiveShadow = true; });
    parts.push({ part: tier, min });
  };
  const box = (key: string, size: [number, number, number], material: THREE.Material, at: [number, number, number]): THREE.Mesh => {
    const mesh = new THREE.Mesh(cache.geometry(key, () => new THREE.BoxGeometry(...size)), material);
    mesh.position.set(...at);
    return mesh;
  };
  const cylinder = (key: string, args: [number, number, number, number], material: THREE.Material, at: [number, number, number]): THREE.Mesh => {
    const mesh = new THREE.Mesh(cache.geometry(key, () => new THREE.CylinderGeometry(...args)), material);
    mesh.position.set(...at);
    return mesh;
  };

  if (kind === 'core') {
    add(2, (tier) => {
      for (let index = 0; index < 4; index += 1) {
        const angle = (index / 4) * Math.PI * 2;
        const pylon = cylinder('core-g2-pylon', [0.22, 0.3, 3.4, 6], cache.plate(team), [Math.cos(angle) * 2.75, 1.7, Math.sin(angle) * 2.75]);
        const lamp = new THREE.Mesh(cache.geometry('core-g2-lamp', () => new THREE.OctahedronGeometry(0.26, 0)), cache.glow(team, 2));
        lamp.position.set(Math.cos(angle) * 2.75, 3.6, Math.sin(angle) * 2.75);
        tier.add(pylon, lamp);
      }
      tier.add(cylinder('core-g2-gallery', [3.05, 3.05, 0.28, 8], cache.frame(team), [0, 3.5, 0]));
    });
    add(3, (tier) => {
      const spire = new THREE.Mesh(cache.geometry('core-g3-spire', () => new THREE.ConeGeometry(0.75, 3.2, 8)), cache.plate(team));
      spire.position.y = 7;
      tier.add(spire, cylinder('core-g3-collar', [1.5, 1.9, 0.5, 8], cache.hull(team), [0, 5.3, 0]));
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2;
        const shard = new THREE.Mesh(cache.geometry('core-g3-shard', () => new THREE.OctahedronGeometry(0.52, 0)), cache.glow(team, 2.6));
        shard.position.set(Math.cos(angle) * 3.3, 6.2, Math.sin(angle) * 3.3);
        tier.add(shard);
      }
    });
  } else if (kind === 'relay') {
    add(2, (tier) => {
      const boom = box('relay-g2-boom', [0.16, 0.16, 2.2], cache.frame(team), [0, 3.1, 0.9]);
      const dish = new THREE.Mesh(cache.geometry('relay-g2-dish', () => new THREE.ConeGeometry(0.62, 0.42, 8, 1, true)), cache.hull(team));
      dish.rotation.set(Math.PI * 0.72, 0, -0.4); dish.position.set(0, 3.3, 1.9);
      tier.add(boom, dish, cylinder('relay-g2-collar', [1.15, 1.3, 0.36, 8], cache.plate(team), [0, 1.2, 0]));
      for (const side of [-1, 1]) tier.add(cylinder('relay-g2-rod', [0.05, 0.05, 1.5, 5], cache.frame(team), [side * 0.55, 3.5, -0.2]));
    });
    add(3, (tier) => {
      const ring = new THREE.Mesh(cache.geometry('relay-g3-ring', () => new THREE.TorusGeometry(1.65, 0.09, 6, 22)), cache.glow(team, 2.2));
      ring.position.y = 4.1; ring.rotation.set(Math.PI / 2, 0, 0.3);
      const mast = cylinder('relay-g3-mast', [0.12, 0.16, 2.4, 6], cache.plate(team), [0, 4.9, 0]);
      const beacon = new THREE.Mesh(cache.geometry('relay-g3-beacon', () => new THREE.OctahedronGeometry(0.42, 0)), cache.glow(team, 2.8));
      beacon.position.y = 6.2;
      tier.add(ring, mast, beacon);
    });
  } else if (kind === 'fabricator') {
    add(2, (tier) => {
      tier.add(box('fab-g2-storey', [3, 1.1, 2], cache.plate(team), [0, 2.85, 0]));
      tier.add(box('fab-g2-trim', [3.1, 0.14, 2.1], cache.glow(team, 1.2), [0, 3.45, 0]));
      for (const side of [-1, 1]) tier.add(cylinder('fab-g2-stack', [0.26, 0.34, 1.5, 6], cache.frame(team), [side * 1.1, 4.1, 0.55]));
      tier.add(cylinder('fab-g2-silo', [0.62, 0.72, 2.4, 8], cache.hull(team), [2.25, 1.2, 0]));
    });
    add(3, (tier) => {
      const dome = new THREE.Mesh(cache.geometry('fab-g3-dome', () => new THREE.SphereGeometry(1.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), cache.glow(team, 1.5));
      dome.position.y = 3.5;
      const gantry = box('fab-g3-gantry', [4.4, 0.22, 0.3], cache.frame(team), [0, 5.1, 0]);
      const hook = box('fab-g3-hook', [0.3, 0.7, 0.3], cache.plate(team), [1.2, 4.6, 0]);
      for (const side of [-1, 1]) tier.add(cylinder('fab-g3-leg', [0.14, 0.18, 1.7, 6], cache.frame(team), [side * 2.1, 4.25, 0]));
      tier.add(dome, gantry, hook);
    });
  } else if (kind === 'habitat') {
    add(2, (tier) => {
      tier.add(cylinder('habitat-g2-storey', [0.95, 1.15, 1.25, 8], cache.plate(team), [0, 2.55, 0]));
      tier.add(cylinder('habitat-g2-balcony', [1.55, 1.55, 0.16, 8], cache.frame(team), [0, 1.95, 0]));
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const window = new THREE.Mesh(cache.geometry('habitat-g2-window', () => new THREE.BoxGeometry(0.42, 0.36, 0.1)), cache.glow(team, 1.6));
        window.position.set(Math.sin(angle) * 1.05, 2.6, Math.cos(angle) * 1.05); window.rotation.y = angle;
        tier.add(window);
      }
    });
    add(3, (tier) => {
      const dome = new THREE.Mesh(cache.geometry('habitat-g3-dome', () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), cache.glow(team, 1.3));
      dome.position.y = 3.2;
      const antenna = cylinder('habitat-g3-antenna', [0.06, 0.08, 1.2, 5], cache.frame(team), [0, 4, 0]);
      const bulb = new THREE.Mesh(cache.geometry('habitat-g3-bulb', () => new THREE.OctahedronGeometry(0.24, 0)), cache.glow(team, 2.6));
      bulb.position.y = 4.7;
      tier.add(dome, antenna, bulb);
    });
  } else if (kind === 'depot') {
    add(2, (tier) => {
      tier.add(cylinder('depot-g2-silo', [0.55, 0.62, 2.2, 8], cache.hull(team), [-1.55, 1.1, 0]));
      tier.add(cylinder('depot-g2-cap', [0.62, 0.5, 0.4, 8], cache.plate(team), [-1.55, 2.35, 0]));
      tier.add(box('depot-g2-walkway', [1.4, 0.12, 0.5], cache.frame(team), [-0.7, 2.15, 0]));
    });
    add(3, (tier) => {
      tier.add(cylinder('depot-g3-silo', [0.55, 0.62, 2.6, 8], cache.hull(team), [1.6, 1.3, 0.2]));
      const jib = box('depot-g3-jib', [2.6, 0.18, 0.22], cache.frame(team), [0.4, 3.1, 0]);
      const load = box('depot-g3-load', [0.42, 0.5, 0.42], cache.glow(team, 1.6), [-0.7, 2.7, 0]);
      tier.add(jib, load);
    });
  } else if (kind === 'wall') {
    add(2, (tier) => {
      tier.add(box('wall-g2-cap', [1.85, 0.55, 0.72], cache.plate(team), [0, 1.78, 0]));
      for (const x of [-0.62, 0, 0.62]) tier.add(box('wall-g2-tooth', [0.34, 0.4, 0.34], cache.frame(team), [x, 2.2, 0]));
    });
    add(3, (tier) => {
      for (const side of [-1, 1]) {
        tier.add(cylinder('wall-g3-emitter', [0.14, 0.18, 0.9, 6], cache.frame(team), [side * 0.8, 2.6, 0]));
        const node = new THREE.Mesh(cache.geometry('wall-g3-node', () => new THREE.OctahedronGeometry(0.2, 0)), cache.glow(team, 2.6));
        node.position.set(side * 0.8, 3.1, 0); tier.add(node);
      }
      tier.add(box('wall-g3-curtain', [1.6, 0.5, 0.1], cache.glow(team, 1.1), [0, 3, 0]));
    });
  } else if (kind === 'gate') {
    add(2, (tier) => {
      tier.add(box('gate-g2-arch', [2.3, 0.3, 0.75], cache.plate(team), [0, 2.45, 0]));
      for (const side of [-1, 1]) tier.add(box('gate-g2-buttress', [0.28, 1.2, 0.9], cache.frame(team), [side * 1.05, 1.2, 0]));
    });
    add(3, (tier) => {
      tier.add(box('gate-g3-curtain', [1.35, 1.7, 0.08], cache.glow(team, 1.1), [0, 1, 0]));
      const crest = new THREE.Mesh(cache.geometry('gate-g3-crest', () => new THREE.OctahedronGeometry(0.34, 0)), cache.glow(team, 2.6));
      crest.position.y = 2.9; tier.add(crest);
    });
  } else if (kind === 'outpost') {
    add(2, (tier) => {
      tier.add(cylinder('outpost-g2-skirt', [2.1, 2.3, 0.3, 8], cache.frame(team), [0, 0.5, 0]));
      const dish = new THREE.Mesh(cache.geometry('outpost-g2-dish', () => new THREE.ConeGeometry(0.7, 0.45, 8, 1, true)), cache.hull(team));
      dish.rotation.set(Math.PI * 0.7, 0, 0.3); dish.position.set(0.75, 3.3, 0);
      tier.add(dish, box('outpost-g2-boom', [1.4, 0.14, 0.14], cache.frame(team), [0.4, 3.05, 0]));
    });
    add(3, (tier) => {
      const shield = new THREE.Mesh(cache.geometry('outpost-g3-shield', () => new THREE.SphereGeometry(2.05, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)), cache.glow(team, 0.9));
      shield.position.y = 0.5;
      tier.add(shield);
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2;
        const pod = new THREE.Mesh(cache.geometry('outpost-g3-pod', () => new THREE.OctahedronGeometry(0.3, 0)), cache.glow(team, 2.4));
        pod.position.set(Math.cos(angle) * 2.3, 3.8, Math.sin(angle) * 2.3);
        tier.add(pod);
      }
    });
  } else if (kind === 'turret') {
    add(2, (tier) => {
      for (const side of [-1, 1]) {
        tier.add(box('turret-g2-pod', [0.4, 0.42, 0.7], cache.plate(team), [side * 0.85, 2, 0.1]));
        tier.add(cylinder('turret-g2-gun', [0.09, 0.11, 1.1, 6], cache.frame(team), [side * 0.85, 2, -0.8]));
      }
      tier.add(cylinder('turret-g2-ring', [1.15, 1.15, 0.22, 8], cache.frame(team), [0, 0.7, 0]));
    });
    add(3, (tier) => {
      tier.add(cylinder('turret-g3-cannon', [0.24, 0.3, 2, 8], cache.plate(team), [0, 2.6, -0.9]));
      tier.add(box('turret-g3-pack', [1.1, 0.7, 0.7], cache.hull(team), [0, 2.7, 0.8]));
      const muzzle = new THREE.Mesh(cache.geometry('turret-g3-muzzle', () => new THREE.OctahedronGeometry(0.28, 0)), cache.glow(team, 3));
      muzzle.position.set(0, 2.6, -1.9); tier.add(muzzle);
    });
  } else {
    add(2, (tier) => {
      tier.add(box('foundry-g2-annex', [1.6, 1.6, 2.6], cache.plate(team), [2.6, 1.1, 0]));
      tier.add(cylinder('foundry-g2-stack', [0.3, 0.42, 2.2, 7], cache.frame(team), [0, 3.6, -1.1]));
    });
    add(3, (tier) => {
      const crucible = new THREE.Mesh(cache.geometry('foundry-g3-crucible', () => new THREE.SphereGeometry(1.05, 10, 7)), cache.glow(team, 2.2));
      crucible.position.set(0, 4.4, 0);
      tier.add(crucible, cylinder('foundry-g3-frame', [1.35, 1.5, 0.4, 8], cache.frame(team), [0, 3.6, 0]));
      for (const side of [-1, 1]) tier.add(box('foundry-g3-fin', [0.24, 2.2, 1.1], cache.plate(team), [side * 2.2, 3.2, 0]));
    });
  }
  return parts;
}

export function buildBuildingModel(cache: ResourceCache, kind: BuildingTypeId, team: Team, id: string): BuildingModel {
  const model = kind === 'core' ? buildCore(cache, team, id)
    : kind === 'relay' ? buildRelay(cache, team, id)
      : kind === 'fabricator' ? buildFabricator(cache, team, id)
        : kind === 'habitat' ? buildHabitat(cache, team, id)
          : kind === 'depot' ? buildDepot(cache, team, id)
            : kind === 'wall' ? buildWall(cache, team, id)
              : kind === 'gate' ? buildGate(cache, team, id)
                : kind === 'outpost' ? buildOutpost(cache, team, id)
                  : kind === 'turret' ? buildTurret(cache, team, id)
                    : buildFoundry(cache, team, id);
  const upgrades = generationUpgrades(cache, kind, team);
  for (const entry of upgrades) model.group.add(entry.part);
  return { ...model, generationParts: [...model.generationParts, ...upgrades] };
}

/** Scaffolding shown while a site is still being assembled. */
export function buildConstructionScaffold(cache: ResourceCache, kind: BuildingTypeId, team: Team): THREE.Group {
  const group = new THREE.Group();
  const config = BUILDINGS[kind];
  const [width, depth] = config.footprint;
  const post = cache.geometry('scaffold-post', () => new THREE.BoxGeometry(0.16, 1, 0.16));
  const frame = cache.frame(team);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pillar = new THREE.Mesh(post, frame);
    pillar.position.set((dx * width) / 2 - dx * 0.2, 0.5, (dz * depth) / 2 - dz * 0.2);
    group.add(pillar);
  }
  const beam = new THREE.Mesh(cache.geometry('scaffold-beam', () => new THREE.BoxGeometry(width, 0.12, 0.12)), frame);
  beam.position.y = 1;
  group.add(beam);
  return group;
}
