import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { UnitTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import { paletteFor, type ResourceCache } from './palette';
import { Machinery } from './machinery';
import { applyMachineryMaterials } from './machineryMaterials';

export interface UnitModel {
  readonly group: THREE.Group;
  readonly legs: THREE.Object3D[];
  readonly arms: THREE.Object3D[];
  readonly turret: THREE.Object3D | null;
  readonly barrel: THREE.Object3D | null;
  readonly weapons: THREE.Object3D[];
  readonly muzzles: THREE.Object3D[];
  readonly tool: THREE.Object3D | null;
  readonly cargo: THREE.Object3D | null;
  readonly optic: THREE.Object3D | null;
  readonly hover: THREE.Object3D | null;
  readonly pickable: THREE.Object3D[];
}

/** Armour is attached to its joint, so detail follows walking, aiming and recoil. */
function humanoid(cache: ResourceCache, kind: UnitTypeId, team: Team, id: string): UnitModel {
  const m = new Machinery(cache, team, id); const group = new THREE.Group();
  const worker = kind === 'worker'; const heavy = kind === 'titan'; const ranger = kind === 'ranger';
  const armour = cache.armour(team); const frame = cache.frame(team); const paint = cache.plate(team);
  const steel = cache.steel(); const glow = cache.glow(team, 1.5);
  const width = heavy ? 0.94 : worker ? 0.56 : 0.72; const hipY = heavy ? 0.85 : 0.64;
  const legs: THREE.Object3D[] = []; const arms: THREE.Object3D[] = [];
  const weapons: THREE.Object3D[] = []; const muzzles: THREE.Object3D[] = [];
  let tool: THREE.Object3D | null = null;
  for (const side of [-1, 1]) {
    const limb = new THREE.Group(); limb.position.set(side * width * 0.32, hipY, 0);
    limb.userData.restY = hipY; group.add(limb); legs.push(limb);
    m.cylinder(limb, 0.13, 0.22, [0, 0, 0], frame, 'x');
    m.box(limb, [0.19, hipY * 0.35, 0.2], [0, -hipY * 0.2, 0], steel);
    const thigh = m.box(limb, [0.25, hipY * 0.38, 0.27], [side * 0.025, -hipY * 0.18, -0.04], armour, 0.055); thigh.rotation.x = 0.16;
    m.cylinder(limb, 0.115, 0.28, [0, -hipY * 0.43, -0.01], frame, 'x');
    m.box(limb, [0.22, 0.16, 0.12], [0, -hipY * 0.42, -0.15], paint);
    m.box(limb, [0.2, hipY * 0.31, 0.22], [0, -hipY * 0.68, 0.015], frame);
    m.box(limb, [0.23, hipY * 0.27, 0.1], [0, -hipY * 0.66, -0.12], armour, 0.035);
    m.piston(limb, [side * 0.12, -hipY * 0.48, 0.04], [side * 0.12, -hipY * 0.83, 0.04], 0.027);
    m.box(limb, [0.28, 0.11, 0.4], [0, -hipY + 0.08, -0.08], frame);
    m.box(limb, [0.25, 0.075, 0.22], [0, -hipY + 0.16, -0.15], armour, 0.025);
    m.box(limb, [0.12, 0.025, 0.03], [0, -hipY + 0.19, -0.265], cache.hazard(), 0.005);
  }
  m.box(group, [width * 0.8, 0.19, 0.34], [0, hipY + 0.02, 0], frame);
  for (const side of [-1, 1]) m.box(group, [width * 0.33, 0.2, 0.13], [side * width * 0.29, hipY, -0.2], paint);
  const torso = new THREE.Group(); torso.position.y = hipY + 0.34; group.add(torso);
  m.box(torso, [width * 0.86, 0.43, 0.37], [0, 0, 0], frame, 0.085);
  const chest = m.box(torso, [width, 0.38, 0.24], [0, 0.055, -0.14], armour, 0.075); chest.rotation.x = -0.17;
  m.box(torso, [width * 0.58, 0.18, 0.045], [0, 0.08, -0.28], paint, 0.025);
  for (const side of [-1, 1]) {
    const cheek = m.box(torso, [width * 0.19, 0.28, 0.055], [side * width * 0.35, 0.02, -0.265], armour, 0.035);
    cheek.rotation.z = side * 0.22;
    for (let slot = 0; slot < 3; slot++) m.box(torso, [0.07, 0.018, 0.015], [side * width * 0.34, -0.035 + slot * 0.045, -0.3], frame, 0.003);
  }
  m.box(torso, [width * 0.25, 0.045, 0.02], [0, 0.1, -0.309], glow, 0.008);
  m.box(torso, [width * 0.45, 0.065, 0.05], [0, -0.16, -0.215], cache.hazard(), 0.01);
  for (const side of [-1, 1]) {
    m.cylinder(torso, 0.025, 0.04, [side * width * 0.36, 0.16, -0.27], frame, 'z');
    m.cylinder(torso, 0.105, 0.34, [side * width * 0.36, 0.04, 0.26], frame);
    m.cylinder(torso, 0.11, 0.045, [side * width * 0.36, 0.22, 0.26], steel);
    m.box(torso, [0.04, 0.16, 0.03], [side * width * 0.36, 0.03, 0.37], glow, 0.005);
  }
  m.box(torso, [width * 0.55, 0.34, 0.16], [0, 0, 0.27], paint);
  const cargo = worker ? m.box(torso, [0.23, 0.23, 0.13], [0, 0, 0.39], glow) : null; if (cargo) cargo.visible = false;
  m.cylinder(torso, 0.11, 0.13, [0, 0.28, 0], steel);
  const headY = heavy ? 0.28 : 0.4;
  m.box(torso, [worker ? 0.32 : 0.36, 0.28, 0.31], [0, headY, -0.025], armour, 0.065);
  m.box(torso, [0.29, 0.13, 0.07], [0, headY - 0.01, -0.18], frame, 0.025);
  const optic = m.box(torso, [0.18, 0.055, 0.025], [0, headY + 0.005, -0.223], glow, 0.008);
  m.box(torso, [0.14, 0.045, 0.22], [0, headY + 0.15, -0.02], paint, 0.015);
  if (heavy) {
    for (const side of [-1, 1]) {
      const collar = m.box(torso, [0.24, 0.32, 0.42], [side * 0.3, 0.3, 0.06], armour, 0.065); collar.rotation.z = side * -0.3;
      m.box(torso, [0.15, 0.22, 0.15], [side * 0.3, 0.32, 0.28], frame);
      for (let slot = 0; slot < 4; slot++) m.box(torso, [0.11, 0.022, 0.025], [side * 0.3, 0.25 + slot * 0.045, 0.37], steel, 0.005);
    }
  }
  m.cylinder(torso, 0.018, worker ? 0.24 : 0.18, [0.11, 0.69, 0.055], steel);
  if (worker) {
    const aerial = new THREE.Mesh(cache.geometry('worker-signal-loop', () => new THREE.TorusGeometry(0.1, 0.013, 5, 12)), glow);
    aerial.position.set(0.11, 0.82, 0.055); aerial.rotation.x = Math.PI / 2; torso.add(aerial);
  }
  let barrel: THREE.Group | null = null;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * (width / 2 + 0.1), 0.11, 0); torso.add(arm); arms.push(arm);
    m.cylinder(arm, 0.135, 0.15, [0, 0, 0], frame, 'x');
    m.box(arm, [heavy ? 0.32 : 0.24, 0.25, 0.34], [side * 0.025, 0.025, 0], armour, 0.065);
    m.cylinder(arm, 0.07, 0.025, [side * 0.16, 0.04, 0], paint, 'x');
    m.cylinder(arm, 0.035, 0.032, [side * 0.18, 0.04, 0], steel, 'x');
    m.box(arm, [0.12, 0.03, 0.025], [0, 0.09, -0.181], cache.hazard(), 0.005);
    for (let stripe = 0; stripe < 3; stripe++) m.box(arm, [0.06, 0.012, 0.012], [0.035, 0.04 - stripe * 0.025, -0.185], frame, 0.002);
    m.box(arm, [0.14, 0.22, 0.14], [0, -0.21, 0], steel);
    m.cylinder(arm, 0.075, 0.18, [0, -0.32, 0], frame, 'x');
    m.box(arm, [0.19, 0.24, 0.22], [0, -0.43, -0.04], paint);
    m.box(arm, [0.14, 0.18, 0.055], [0, -0.42, -0.17], armour, 0.025);
    m.box(arm, [0.15, 0.12, 0.14], [0, -0.61, -0.07], frame, 0.025);
    for (const finger of [-1, 1]) m.box(arm, [0.045, 0.1, 0.07], [finger * 0.055, -0.68, -0.09], steel, 0.012);
    if (worker && side === 1) {
      m.cylinder(arm, 0.085, 0.23, [0, -0.56, -0.2], frame, 'z');
      const bit = new THREE.Mesh(cache.geometry('worker-drill-bit', () => new THREE.ConeGeometry(0.055, 0.23, 8)), steel);
      bit.rotation.x = -Math.PI / 2; bit.position.set(0, -0.56, -0.42); arm.add(bit);
      tool = bit; tool.name = 'harvest-drill'; arm.name = 'tool-arm';
      tool.userData.entityId = id; tool.castShadow = tool.receiveShadow = true;
    }
    if (!worker && (side === 1 || heavy)) {
      const gun = new THREE.Group(); gun.position.set(0, -0.45, -0.3); arm.add(gun); if (side === 1) barrel = gun;
      gun.name = 'weapon'; weapons.push(gun);
      const length = ranger ? 0.94 : heavy ? 0.62 : 0.48;
      m.box(gun, [0.17, 0.18, 0.38], [0, 0, -0.12], frame);
      m.box(gun, [0.19, 0.085, 0.3], [0, 0.1, -0.14], armour, 0.025);
      m.cylinder(gun, 0.04, length, [0, 0, -0.28 - length / 2], steel, 'z');
      m.cylinder(gun, 0.07, 0.12, [0, 0, -0.28 - length], frame, 'z');
      m.cylinder(gun, 0.032, 0.015, [0, 0, -0.35 - length], glow, 'z');
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.37 - length); gun.add(muzzle); muzzles.push(muzzle);
      m.box(gun, [0.025, 0.055, 0.23], [0.1, 0, -0.15], glow, 0.008);
      if (ranger) m.cylinder(gun, 0.045, 0.28, [0, 0.2, -0.14], paint, 'z');
    }
  }
  if (heavy) group.scale.setScalar(1.8);
  return { group, legs, arms, turret: worker ? null : torso, barrel, weapons, muzzles, tool, cargo, optic, hover: null, pickable: [] };
}

function scout(cache: ResourceCache, team: Team, id: string): UnitModel {
  const m = new Machinery(cache, team, id); const group = new THREE.Group();
  const hover = new THREE.Group(); hover.position.y = 1.2; group.add(hover);
  const frame = cache.frame(team); const hull = cache.armour(team); const glow = cache.glow(team, 1.5);
  m.box(hover, [0.5, 0.25, 0.7], [0, 0, 0], frame, 0.09);
  const shell = m.box(hover, [0.47, 0.18, 0.6], [0, 0.14, 0], hull, 0.085); shell.rotation.x = 0.15;
  m.box(hover, [0.23, 0.04, 0.27], [0, 0.255, 0.03], cache.plate(team));
  m.cylinder(hover, 0.12, 0.1, [0, -0.015, -0.38], frame, 'z');
  const optic = m.cylinder(hover, 0.075, 0.035, [0, -0.015, -0.45], glow, 'z');
  const rotors: THREE.Object3D[] = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const beam = m.box(hover, [0.52, 0.07, 0.09], [x * 0.38, 0.05, z * 0.3], frame, 0.02); beam.rotation.y = x * z * -0.42;
    m.cylinder(hover, 0.09, 0.17, [x * 0.62, 0.04, z * 0.4], cache.plate(team));
    m.cylinder(hover, 0.055, 0.04, [x * 0.62, -0.07, z * 0.4], glow);
    const rotor = new THREE.Group(); rotor.position.set(x * 0.62, 0.16, z * 0.4); hover.add(rotor); rotors.push(rotor);
    m.box(rotor, [0.6, 0.025, 0.07], [0, 0, 0], frame, 0.018);
    m.box(rotor, [0.07, 0.025, 0.6], [0, 0.006, 0], frame, 0.018);
    m.cylinder(rotor, 0.045, 0.035, [0, 0.025, 0], cache.steel());
    m.piston(hover, [x * 0.18, -0.07, z * 0.2], [x * 0.26, -0.38, z * 0.27], 0.022);
  }
  return { group, legs: rotors, arms: [], turret: hover, barrel: null, weapons: [], muzzles: [optic], tool: null, cargo: null, optic, hover, pickable: [] };
}

/** Merge inside each articulation, retaining animation pivots and sharing buffers across an army. */
function batch(model: UnitModel, cache: ResourceCache, kind: UnitTypeId, team: Team, id: string): UnitModel {
  const animated = new Set([model.group, ...model.legs, ...model.arms, ...model.weapons, model.tool, model.turret, model.barrel, model.cargo, model.optic, model.hover].filter((part): part is THREE.Object3D => part !== null));
  const pickable: THREE.Object3D[] = [];
  for (const [anchorIndex, anchor] of [...animated].entries()) {
    if (anchor instanceof THREE.Mesh) { pickable.push(anchor); continue; }
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    const visit = (object: THREE.Object3D): void => {
      for (const child of object.children) {
        if (animated.has(child)) continue;
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.Material;
          const meshes = buckets.get(material) ?? []; meshes.push(child); buckets.set(material, meshes);
        }
        visit(child);
      }
    };
    model.group.updateMatrixWorld(true); visit(anchor);
    const inverse = anchor.matrixWorld.clone().invert();
    for (const [material, meshes] of buckets) {
      const geometry = cache.geometry(`agent-batch-${kind}-${team}-${anchorIndex}-${material.uuid}`, () => {
        const parts = meshes.map((mesh) => {
          const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
          part.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)); return part;
        });
        const merged = mergeGeometries(parts)!; parts.forEach((part) => part.dispose()); return merged;
      });
      meshes.forEach((mesh) => mesh.removeFromParent());
      const combined = new THREE.Mesh(geometry, material); combined.userData.entityId = id;
      combined.castShadow = combined.receiveShadow = true; anchor.add(combined); pickable.push(combined);
    }
  }
  return { ...model, pickable };
}

export function buildUnitModel(cache: ResourceCache, kind: UnitTypeId, team: Team, id: string): UnitModel {
  const model = kind === 'scout' ? scout(cache, team, id) : humanoid(cache, kind, team, id);
  applyMachineryMaterials(model.group, cache, team, 'unit');
  return batch(model, cache, kind, team, id);
}

export function unitGlowColor(team: Team): number { return paletteFor(team).glow; }
