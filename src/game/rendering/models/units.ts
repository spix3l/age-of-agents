import * as THREE from 'three';
import type { UnitTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import type { ResourceCache } from './palette';
import { paletteFor } from './palette';

export interface UnitModel {
  readonly group: THREE.Group;
  /** Everything the renderer animates: legs swing, cargo fills, barrels recoil, turrets track. */
  readonly legs: THREE.Object3D[];
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

/**
 * Worker Agent: a segmented hauler on two articulated legs with a folding mining arm and a
 * cargo pod that visibly fills as it carries Matter or Energy home.
 */
function buildWorker(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.hull(team);
  const frame = cache.frame(team);

  const chassis = new THREE.Mesh(cache.geometry('worker-chassis', () => new THREE.BoxGeometry(0.78, 0.36, 0.92)), plate);
  chassis.position.y = 0.74;
  tag(chassis, id, pickable);

  const belly = new THREE.Mesh(cache.geometry('worker-belly', () => new THREE.BoxGeometry(0.62, 0.22, 0.74)), frame);
  belly.position.y = 0.52;
  tag(belly, id, pickable);

  const shoulders = new THREE.Mesh(cache.geometry('worker-shoulders', () => new THREE.CylinderGeometry(0.34, 0.4, 0.26, 6)), hull);
  shoulders.position.y = 1.02;
  tag(shoulders, id, pickable);

  const head = new THREE.Mesh(cache.geometry('worker-head', () => new THREE.BoxGeometry(0.46, 0.3, 0.4)), hull);
  head.position.set(0, 1.24, -0.06);
  tag(head, id, pickable);

  const optic = new THREE.Mesh(cache.geometry('worker-optic', () => new THREE.BoxGeometry(0.34, 0.09, 0.06)), cache.glow(team, 2.2));
  optic.position.set(0, 1.26, -0.27);

  // Folding mining arm along the right flank.
  const armRoot = new THREE.Group();
  armRoot.position.set(0.42, 0.92, -0.1);
  const upperArm = new THREE.Mesh(cache.geometry('worker-arm-upper', () => new THREE.BoxGeometry(0.14, 0.14, 0.52)), frame);
  upperArm.position.z = -0.24;
  upperArm.rotation.x = 0.5;
  const drill = new THREE.Mesh(cache.geometry('worker-drill', () => new THREE.ConeGeometry(0.13, 0.36, 6)), cache.frame(team));
  drill.position.set(0, -0.16, -0.52);
  drill.rotation.x = -Math.PI / 2 + 0.4;
  armRoot.add(upperArm, drill);
  tag(upperArm, id, pickable);

  // Cargo pod: scaled and lit by how much the Worker is carrying.
  const cargo = new THREE.Mesh(cache.geometry('worker-cargo', () => new THREE.BoxGeometry(0.44, 0.34, 0.34)), cache.glow(team, 0.9));
  cargo.position.set(-0.06, 0.86, 0.62);
  cargo.visible = false;

  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.3, 0.5, 0);
    const thigh = new THREE.Mesh(cache.geometry('worker-thigh', () => new THREE.BoxGeometry(0.16, 0.34, 0.18)), frame);
    thigh.position.y = -0.16;
    const foot = new THREE.Mesh(cache.geometry('worker-foot', () => new THREE.BoxGeometry(0.22, 0.12, 0.36)), plate);
    foot.position.y = -0.4;
    leg.add(thigh, foot);
    tag(thigh, id, pickable);
    group.add(leg);
    legs.push(leg);
  }

  group.add(chassis, belly, shoulders, head, optic, armRoot, cargo);
  return { group, legs, turret: null, barrel: null, cargo, optic, hover: null, pickable };
}

/**
 * Striker: a tracked assault chassis with a rotating turret, a recoiling plasma barrel, and a
 * charge coil that reads clearly at default zoom.
 */
function buildStriker(cache: ResourceCache, team: Team, id: string): UnitModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const plate = cache.plate(team);
  const hull = cache.hull(team);
  const frame = cache.frame(team);

  const hullMesh = new THREE.Mesh(cache.geometry('striker-hull', () => new THREE.BoxGeometry(1.12, 0.34, 1.36)), plate);
  hullMesh.position.y = 0.52;
  tag(hullMesh, id, pickable);

  const glacis = new THREE.Mesh(cache.geometry('striker-glacis', () => new THREE.BoxGeometry(0.9, 0.2, 0.5)), hull);
  glacis.position.set(0, 0.66, -0.6);
  glacis.rotation.x = -0.42;
  tag(glacis, id, pickable);

  const skirt = new THREE.Mesh(cache.geometry('striker-skirt', () => new THREE.BoxGeometry(1.24, 0.16, 1.42)), frame);
  skirt.position.y = 0.34;
  tag(skirt, id, pickable);

  // Tracks double as the "legs" the renderer bobs while moving.
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const track = new THREE.Group();
    track.position.set(side * 0.62, 0.3, 0);
    const belt = new THREE.Mesh(cache.geometry('striker-track', () => new THREE.BoxGeometry(0.26, 0.42, 1.44)), frame);
    const wheel = new THREE.Mesh(cache.geometry('striker-wheel', () => new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8)), plate);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.z = -0.5;
    track.add(belt, wheel);
    tag(belt, id, pickable);
    group.add(track);
    legs.push(track);
  }

  const turret = new THREE.Group();
  turret.position.y = 0.78;
  const dome = new THREE.Mesh(cache.geometry('striker-dome', () => new THREE.CylinderGeometry(0.32, 0.44, 0.34, 6)), hull);
  dome.position.y = 0.14;
  tag(dome, id, pickable);
  const coil = new THREE.Mesh(cache.geometry('striker-coil', () => new THREE.TorusGeometry(0.22, 0.05, 6, 12)), cache.glow(team, 1.8));
  coil.position.set(0, 0.2, -0.24);
  coil.rotation.x = Math.PI / 2;

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.18, -0.3);
  const tube = new THREE.Mesh(cache.geometry('striker-barrel', () => new THREE.CylinderGeometry(0.08, 0.1, 0.86, 6)), frame);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -0.36;
  const muzzle = new THREE.Mesh(cache.geometry('striker-muzzle', () => new THREE.CylinderGeometry(0.13, 0.11, 0.16, 6)), plate);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = -0.76;
  barrel.add(tube, muzzle);
  tag(tube, id, pickable);

  turret.add(dome, coil, barrel);
  group.add(hullMesh, glacis, skirt, turret);
  return { group, legs, turret, barrel, cargo: null, optic: coil, hover: null, pickable };
}

export function buildUnitModel(cache: ResourceCache, kind: UnitTypeId, team: Team, id: string): UnitModel {
  return kind === 'striker' ? buildStriker(cache, team, id) : buildWorker(cache, team, id);
}

export function unitGlowColor(team: Team): number { return paletteFor(team).glow; }
