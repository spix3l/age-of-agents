import * as THREE from 'three';
import type { UnitTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import type { ResourceCache } from './palette';
import { paletteFor } from './palette';

export interface UnitModel {
  readonly group: THREE.Group;
  /** Everything the renderer animates: legs swing, cargo fills, barrels recoil, turrets track. */
  readonly legs: THREE.Object3D[];
  /** Arms swing opposite to the legs on walking Agents; empty on vehicles and drones. */
  readonly arms: THREE.Object3D[];
  readonly turret: THREE.Object3D | null;
  readonly barrel: THREE.Object3D | null;
  readonly cargo: THREE.Object3D | null;
  readonly optic: THREE.Object3D | null;
  readonly hover: THREE.Object3D | null;
  /** Meshes that carry an entityId and can be clicked. */
  readonly pickable: THREE.Object3D[];
}

function tag(object: THREE.Object3D, id: string, pickable: THREE.Object3D[]): THREE.Object3D {
  object.userData.entityId = id;
  object.castShadow = true;
  pickable.push(object);
  return object;
}

/** A leg group whose rest height is remembered so the walk cycle can bob it without drift. */
function leg(cache: ResourceCache, key: string, x: number, y: number, thigh: [number, number, number], foot: [number, number, number], thighMaterial: THREE.Material, footMaterial: THREE.Material, id: string, pickable: THREE.Object3D[]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  group.userData.restY = y;
  const upper = new THREE.Mesh(cache.roundedBox(`${key}-thigh`, ...thigh, 0.05), thighMaterial);
  upper.position.y = -thigh[1] / 2;
  const shoe = new THREE.Mesh(cache.roundedBox(`${key}-foot`, ...foot, 0.05), footMaterial);
  shoe.position.set(0, -thigh[1] - foot[1] / 2 + 0.02, -0.04);
  group.add(upper, shoe);
  tag(upper, id, pickable);
  tag(shoe, id, pickable);
  return group;
}

/**
 * Worker Agent: a stubby, big-headed hauler in faction overalls with a hazard-yellow hard hat,
 * a backpack cargo pod that lights up as it fills, and a drill in its right hand.
 */
function buildWorker(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.armour(team);
  const frame = cache.frame(team);

  const legs = [-1, 1].map((side) => leg(cache, 'worker', side * 0.17, 0.46, [0.18, 0.3, 0.2], [0.24, 0.12, 0.32], frame, plate, id, pickable));

  const torso = new THREE.Mesh(cache.roundedBox('worker-torso', 0.62, 0.5, 0.44, 0.1), plate);
  torso.position.y = 0.72;
  tag(torso, id, pickable);
  const bib = new THREE.Mesh(cache.roundedBox('worker-bib', 0.34, 0.3, 0.08, 0.03), hull);
  bib.position.set(0, 0.74, -0.22);
  const belt = new THREE.Mesh(cache.roundedBox('worker-belt', 0.64, 0.1, 0.46, 0.03), frame);
  belt.position.y = 0.5;

  const pack = new THREE.Mesh(cache.roundedBox('worker-pack', 0.44, 0.42, 0.24, 0.06), frame);
  pack.position.set(0, 0.8, 0.32);
  tag(pack, id, pickable);
  const cargo = new THREE.Mesh(cache.roundedBox('worker-cargo', 0.3, 0.3, 0.14, 0.03), cache.glow(team, 0.9));
  cargo.position.set(0, 0.8, 0.46);
  cargo.visible = false;

  const head = new THREE.Mesh(cache.roundedBox('worker-head', 0.56, 0.44, 0.5, 0.12), hull);
  head.position.y = 1.24;
  tag(head, id, pickable);
  const visor = new THREE.Mesh(cache.roundedBox('worker-visor', 0.4, 0.16, 0.08, 0.03), cache.glow(team, 2.2));
  visor.position.set(0, 1.25, -0.24);
  const hat = new THREE.Mesh(cache.geometry('worker-hat', () => new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), cache.hazard());
  hat.position.y = 1.4;
  tag(hat, id, pickable);
  const brim = new THREE.Mesh(cache.geometry('worker-brim', () => new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10)), cache.hazard());
  brim.position.set(0, 1.42, -0.04);
  const lamp = new THREE.Mesh(cache.geometry('worker-lamp', () => new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6)), cache.glow(team, 2.4));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 1.55, -0.32);

  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.4, 0.92, 0);
    const upper = new THREE.Mesh(cache.roundedBox('worker-arm', 0.14, 0.4, 0.14, 0.04), plate);
    upper.position.y = -0.18;
    const hand = new THREE.Mesh(cache.geometry('worker-hand', () => new THREE.SphereGeometry(0.09, 6, 5)), frame);
    hand.position.y = -0.42;
    arm.add(upper, hand);
    tag(upper, id, pickable);
    if (side === 1) {
      const drill = new THREE.Mesh(cache.geometry('worker-drill', () => new THREE.ConeGeometry(0.09, 0.4, 6)), cache.steel());
      drill.rotation.x = -Math.PI / 2;
      drill.position.set(0, -0.42, -0.26);
      arm.add(drill);
    }
    group.add(arm);
    arms.push(arm);
  }

  group.add(...legs, torso, bib, belt, pack, cargo, head, visor, hat, brim, lamp);
  return { group, legs, arms, turret: null, barrel: null, cargo, optic: visor, hover: null, pickable };
}

/**
 * Striker: a squat trooper in faction armour with a full-face visor, wide shoulder pads, and a
 * plasma rifle held across the chest that kicks back on every shot.
 */
function buildStriker(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.armour(team);
  const frame = cache.frame(team);

  const legs = [-1, 1].map((side) => leg(cache, 'striker', side * 0.2, 0.5, [0.22, 0.32, 0.24], [0.28, 0.14, 0.36], frame, plateDarkFor(cache, team), id, pickable));

  const torso = new THREE.Mesh(cache.roundedBox('striker-torso', 0.74, 0.56, 0.5, 0.12), hull);
  torso.position.y = 0.8;
  tag(torso, id, pickable);
  const chest = new THREE.Mesh(cache.roundedBox('striker-chest', 0.44, 0.3, 0.1, 0.04), plate);
  chest.position.set(0, 0.86, -0.26);
  const belt = new THREE.Mesh(cache.roundedBox('striker-belt', 0.76, 0.12, 0.52, 0.03), frame);
  belt.position.y = 0.55;
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(cache.roundedBox('striker-pad', 0.3, 0.24, 0.42, 0.08), plate);
    pad.position.set(side * 0.46, 1.06, 0);
    tag(pad, id, pickable);
    group.add(pad);
  }

  const head = new THREE.Mesh(cache.roundedBox('striker-head', 0.52, 0.42, 0.48, 0.14), plate);
  head.position.y = 1.32;
  tag(head, id, pickable);
  const visor = new THREE.Mesh(cache.roundedBox('striker-visor', 0.4, 0.14, 0.08, 0.03), cache.glow(team, 2.2));
  visor.position.set(0, 1.32, -0.24);
  const crest = new THREE.Mesh(cache.roundedBox('striker-crest', 0.08, 0.16, 0.34, 0.03), hull);
  crest.position.set(0, 1.56, 0.02);

  const pack = new THREE.Mesh(cache.roundedBox('striker-pack', 0.46, 0.4, 0.22, 0.06), frame);
  pack.position.set(0, 0.86, 0.34);
  const coil = new THREE.Mesh(cache.geometry('striker-coil', () => new THREE.TorusGeometry(0.12, 0.04, 6, 12)), cache.glow(team, 1.8));
  coil.position.set(0, 0.9, 0.46);

  // The rifle is held across the body; recoil slides it back along the group's -Z.
  const barrel = new THREE.Group();
  barrel.position.set(0.1, 0.84, -0.3);
  const receiver = new THREE.Mesh(cache.roundedBox('striker-rifle', 0.14, 0.18, 0.62, 0.03), frame);
  const tube = new THREE.Mesh(cache.geometry('striker-tube', () => new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6)), cache.steel());
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -0.48;
  const muzzle = new THREE.Mesh(cache.geometry('striker-muzzle', () => new THREE.CylinderGeometry(0.07, 0.05, 0.1, 6)), cache.glow(team, 2.6));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = -0.7;
  const grip = new THREE.Mesh(cache.roundedBox('striker-grip', 0.08, 0.16, 0.1, 0.02), frame);
  grip.position.set(0, -0.14, 0.1);
  barrel.add(receiver, tube, muzzle, grip);
  tag(receiver, id, pickable);

  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.44, 0.98, 0);
    const upper = new THREE.Mesh(cache.roundedBox('striker-arm', 0.16, 0.36, 0.16, 0.05), hull);
    upper.position.set(side * -0.08, -0.14, -0.16);
    upper.rotation.set(-0.9, 0, side * 0.35);
    const hand = new THREE.Mesh(cache.geometry('striker-hand', () => new THREE.SphereGeometry(0.09, 6, 5)), frame);
    hand.position.set(side * -0.24, -0.16, -0.3);
    arm.add(upper, hand);
    group.add(arm);
    arms.push(arm);
  }

  group.add(...legs, torso, chest, belt, head, visor, crest, pack, coil, barrel);
  return { group, legs, arms, turret: null, barrel, cargo: null, optic: coil, hover: null, pickable };
}

/** Ranger: a tall, thin marksman on stilt legs with a hooded sensor head and a rail lance. */
function buildRanger(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.armour(team);
  const frame = cache.frame(team);

  const legs = [-1, 1].map((side) => leg(cache, 'ranger', side * 0.16, 0.86, [0.13, 0.7, 0.16], [0.22, 0.1, 0.4], frame, plateDarkFor(cache, team), id, pickable));

  const torso = new THREE.Mesh(cache.roundedBox('ranger-torso', 0.5, 0.56, 0.36, 0.1), hull);
  torso.position.y = 1.16;
  tag(torso, id, pickable);
  const sash = new THREE.Mesh(cache.roundedBox('ranger-sash', 0.54, 0.16, 0.4, 0.03), plate);
  sash.position.y = 0.94;
  const cloak = new THREE.Mesh(cache.geometry('ranger-cloak', () => new THREE.ConeGeometry(0.34, 0.9, 6, 1, true)), plate);
  cloak.rotation.x = Math.PI;
  cloak.position.set(0, 1.0, 0.16);
  cloak.scale.set(1, 1, 0.55);
  tag(cloak, id, pickable);

  const turret = new THREE.Group();
  turret.position.y = 1.62;
  const head = new THREE.Mesh(cache.roundedBox('ranger-head', 0.42, 0.34, 0.44, 0.12), plate);
  tag(head, id, pickable);
  const hood = new THREE.Mesh(cache.roundedBox('ranger-hood', 0.48, 0.18, 0.5, 0.06), hull);
  hood.position.set(0, 0.16, 0.04);
  const optic = new THREE.Mesh(cache.geometry('ranger-optic', () => new THREE.SphereGeometry(0.11, 7, 5)), cache.glow(team, 2.6));
  optic.position.set(0.1, 0, -0.22);
  const scope = new THREE.Mesh(cache.geometry('ranger-scope', () => new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6)), frame);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(-0.12, 0.02, -0.24);

  const barrel = new THREE.Group();
  barrel.position.set(0.22, -0.34, -0.3);
  const lance = new THREE.Mesh(cache.geometry('ranger-lance', () => new THREE.CylinderGeometry(0.04, 0.06, 1.7, 6)), cache.steel());
  lance.rotation.x = Math.PI / 2;
  lance.position.z = -0.6;
  const stock = new THREE.Mesh(cache.roundedBox('ranger-stock', 0.1, 0.16, 0.5, 0.03), frame);
  stock.position.z = 0.15;
  const tip = new THREE.Mesh(cache.geometry('ranger-tip', () => new THREE.OctahedronGeometry(0.08, 0)), cache.glow(team, 2.8));
  tip.position.z = -1.46;
  barrel.add(lance, stock, tip);
  tag(lance, id, pickable);
  turret.add(head, hood, optic, scope, barrel);

  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.32, 1.32, 0);
    const upper = new THREE.Mesh(cache.roundedBox('ranger-arm', 0.12, 0.42, 0.12, 0.04), hull);
    upper.position.set(0, -0.18, -0.12);
    upper.rotation.x = -0.7;
    arm.add(upper);
    group.add(arm);
    arms.push(arm);
  }

  group.add(...legs, torso, sash, cloak, turret);
  return { group, legs, arms, turret, barrel, cargo: null, optic, hover: null, pickable };
}

/** Scout: a hovering saucer drone with one big lens, a spinning rotor ring, and three fins. */
function buildScout(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const hover = new THREE.Group();
  hover.position.y = 1.2;

  const disc = new THREE.Mesh(cache.geometry('scout-disc', () => new THREE.CylinderGeometry(0.5, 0.36, 0.22, 10)), cache.armour(team));
  tag(disc, id, pickable);
  const dome = new THREE.Mesh(cache.geometry('scout-dome', () => new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), cache.plate(team));
  dome.position.y = 0.1;
  tag(dome, id, pickable);
  const eyeSocket = new THREE.Mesh(cache.geometry('scout-socket', () => new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10)), cache.frame(team));
  eyeSocket.rotation.x = Math.PI / 2;
  eyeSocket.position.set(0, 0.02, -0.46);
  const optic = new THREE.Mesh(cache.geometry('scout-optic', () => new THREE.SphereGeometry(0.15, 8, 6)), cache.glow(team, 2.6));
  optic.position.set(0, 0.02, -0.5);
  const rotor = new THREE.Mesh(cache.geometry('scout-rotor', () => new THREE.TorusGeometry(0.66, 0.05, 5, 16)), cache.glow(team, 1.2));
  rotor.rotation.x = Math.PI / 2;
  rotor.position.y = -0.02;
  for (let index = 0; index < 3; index += 1) {
    const angle = index * Math.PI * 2 / 3 + Math.PI / 6;
    const fin = new THREE.Mesh(cache.roundedBox('scout-fin', 0.34, 0.06, 0.16, 0.02), cache.plate(team));
    fin.position.set(Math.cos(angle) * 0.62, -0.04, Math.sin(angle) * 0.62);
    fin.rotation.y = -angle;
    hover.add(fin);
  }
  const antenna = new THREE.Mesh(cache.geometry('scout-antenna', () => new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4)), cache.frame(team));
  antenna.position.set(0, 0.5, 0.1);
  const bulb = new THREE.Mesh(cache.geometry('scout-bulb', () => new THREE.SphereGeometry(0.06, 6, 4)), cache.glow(team, 2.4));
  bulb.position.set(0, 0.72, 0.1);
  hover.add(disc, dome, eyeSocket, optic, rotor, antenna, bulb);
  group.add(hover);
  return { group, legs: [rotor], arms: [], turret: hover, barrel: null, cargo: null, optic, hover, pickable };
}

/** Titan: a four-legged siege walker with a reactor spine, twin cannons, and a missile pod. */
function buildTitan(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.armour(team);
  const frame = cache.frame(team);

  const body = new THREE.Mesh(cache.roundedBox('titan-body', 2.0, 1.0, 2.3, 0.18), hull);
  body.position.y = 1.5;
  tag(body, id, pickable);
  const armor = new THREE.Mesh(cache.roundedBox('titan-armor', 2.3, 0.34, 1.8, 0.1), plate);
  armor.position.y = 2.05;
  tag(armor, id, pickable);
  const skirt = new THREE.Mesh(cache.roundedBox('titan-skirt', 2.2, 0.3, 2.4, 0.08), frame);
  skirt.position.y = 1.0;
  const prow = new THREE.Mesh(cache.roundedBox('titan-prow', 1.2, 0.5, 0.5, 0.1), plate);
  prow.position.set(0, 1.42, -1.3);
  tag(prow, id, pickable);
  const eye = new THREE.Mesh(cache.roundedBox('titan-eye', 0.8, 0.14, 0.08, 0.03), cache.glow(team, 2.4));
  eye.position.set(0, 1.5, -1.56);

  const legs: THREE.Object3D[] = [];
  for (const x of [-1, 1]) for (const z of [-0.8, 0.8]) {
    const limb = new THREE.Group();
    limb.position.set(x * 1.05, 1.1, z);
    limb.userData.restY = 1.1;
    const hip = new THREE.Mesh(cache.geometry('titan-hip', () => new THREE.SphereGeometry(0.3, 8, 6)), frame);
    const thigh = new THREE.Mesh(cache.roundedBox('titan-thigh', 0.36, 0.9, 0.4, 0.08), frame);
    thigh.position.set(x * 0.2, -0.5, 0);
    thigh.rotation.z = x * -0.25;
    const shin = new THREE.Mesh(cache.roundedBox('titan-shin', 0.3, 0.5, 0.34, 0.06), plate);
    shin.position.set(x * 0.36, -0.95, 0);
    const foot = new THREE.Mesh(cache.roundedBox('titan-foot', 0.7, 0.22, 0.8, 0.06), frame);
    foot.position.set(x * 0.4, -1.1, 0);
    limb.add(hip, thigh, shin, foot);
    tag(thigh, id, pickable);
    legs.push(limb);
    group.add(limb);
  }

  const turret = new THREE.Group();
  turret.position.y = 2.3;
  const dome = new THREE.Mesh(cache.geometry('titan-dome', () => new THREE.CylinderGeometry(0.7, 0.95, 0.6, 8)), frame);
  tag(dome, id, pickable);
  const cap = new THREE.Mesh(cache.geometry('titan-cap', () => new THREE.CylinderGeometry(0.5, 0.7, 0.3, 8)), hull);
  cap.position.y = 0.42;
  const optic = new THREE.Mesh(cache.geometry('titan-reactor', () => new THREE.OctahedronGeometry(0.3, 0)), cache.glow(team, 2.4));
  optic.position.y = 0.72;
  const barrel = new THREE.Group();
  barrel.position.z = -0.3;
  for (const side of [-1, 1]) {
    const cannon = new THREE.Mesh(cache.geometry('titan-cannon', () => new THREE.CylinderGeometry(0.14, 0.2, 1.7, 8)), cache.steel());
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(side * 0.42, 0.05, -0.8);
    tag(cannon, id, pickable);
    const muzzle = new THREE.Mesh(cache.geometry('titan-muzzle', () => new THREE.CylinderGeometry(0.2, 0.16, 0.2, 8)), cache.glow(team, 2.4));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(side * 0.42, 0.05, -1.66);
    barrel.add(cannon, muzzle);
  }
  const pod = new THREE.Mesh(cache.roundedBox('titan-pod', 0.7, 0.4, 0.9, 0.06), plate);
  pod.position.set(0.95, 0.35, 0.3);
  tag(pod, id, pickable);
  for (const [index, offset] of [-0.2, 0, 0.2].entries()) {
    const cell = new THREE.Mesh(cache.geometry('titan-cell', () => new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6)), cache.glow(team, 1.8));
    cell.rotation.x = Math.PI / 2;
    cell.position.set(0.95 + (index % 2) * 0.16 - 0.08, 0.35, -0.15 + offset);
    turret.add(cell);
  }
  turret.add(dome, cap, optic, barrel, pod);

  group.add(body, armor, skirt, prow, eye, turret);
  group.scale.setScalar(1.15);
  return { group, legs, arms: [], turret, barrel, cargo: null, optic, hover: null, pickable };
}

function plateDarkFor(cache: ResourceCache, team: Team): THREE.MeshStandardMaterial {
  return cache.plateDark(team);
}

export function buildUnitModel(cache: ResourceCache, kind: UnitTypeId, team: Team, id: string): UnitModel {
  if (kind === 'worker') return buildWorker(cache, team, id);
  if (kind === 'striker') return buildStriker(cache, team, id);
  if (kind === 'ranger') return buildRanger(cache, team, id);
  if (kind === 'scout') return buildScout(cache, team, id);
  return buildTitan(cache, team, id);
}

export function unitGlowColor(team: Team): number { return paletteFor(team).glow; }
