import * as THREE from 'three';
import type { ResourceCache } from './palette';
import type { BuildingTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';

type V3 = [number, number, number];

/** Machined parts with real depth: dark gasket, bevelled plate, recessed insert and bolts. */
export class Machinery {
  constructor(readonly cache: ResourceCache, readonly team: Team, readonly id: string) {}

  box(parent: THREE.Object3D, size: V3, at: V3, material: THREE.Material, radius = 0.04): THREE.Mesh {
    const key = `machine-box-${size.join('-')}-${radius}`;
    const geometry = this.cache.geometry(key, () => {
      const [w, h, d] = size; const x = w / 2; const y = h / 2;
      const c = Math.min(radius, w * 0.22, h * 0.22);
      const shape = new THREE.Shape();
      shape.moveTo(-x + c, -y); shape.lineTo(x - c, -y); shape.lineTo(x, -y + c);
      shape.lineTo(x, y - c); shape.lineTo(x - c, y); shape.lineTo(-x + c, y);
      shape.lineTo(-x, y - c); shape.lineTo(-x, -y + c); shape.closePath();
      const bevel = Math.min(0.012, d * 0.12, w * 0.04, h * 0.04);
      const result = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
      result.translate(0, 0, -d / 2 + bevel);
      return result;
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.entityId = this.id;
    parent.add(mesh);
    return mesh;
  }

  cylinder(parent: THREE.Object3D, radius: number, length: number, at: V3, material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y'): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cache.geometry(`machine-cylinder-${radius}-${length}`, () => new THREE.CylinderGeometry(radius, radius, length, 12)), material);
    mesh.position.set(...at);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.entityId = this.id;
    parent.add(mesh);
    return mesh;
  }

  panel(parent: THREE.Object3D, width: number, height: number, at: V3, yaw = 0): THREE.Group {
    const panel = new THREE.Group();
    panel.position.set(...at);
    panel.rotation.y = yaw;
    parent.add(panel);
    this.box(panel, [width + 0.08, height + 0.08, 0.12], [0, 0, 0], this.cache.frame(this.team));
    this.box(panel, [width, height, 0.14], [0, 0, 0.075], this.cache.hull(this.team), 0.075);
    this.box(panel, [width * 0.68, height * 0.52, 0.035], [0, 0, 0.154], this.cache.plate(this.team), 0.025);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      this.cylinder(panel, Math.min(width, height) * 0.035, 0.035, [x * width * 0.38, y * height * 0.36, 0.16], this.cache.frame(this.team), 'z');
    }
    return panel;
  }

  vent(parent: THREE.Object3D, width: number, height: number, at: V3, yaw = 0): void {
    const vent = new THREE.Group();
    vent.position.set(...at); vent.rotation.y = yaw; parent.add(vent);
    this.box(vent, [width + 0.1, height + 0.1, 0.16], [0, 0, 0], this.cache.hull(this.team));
    this.box(vent, [width, height, 0.08], [0, 0, 0.1], this.cache.frame(this.team), 0.02);
    const count = Math.max(3, Math.round(height / 0.12));
    for (let slot = 0; slot < count; slot++) {
      const slat = this.box(vent, [width * 0.87, 0.045, 0.065], [0, -height * 0.4 + slot * height * 0.8 / (count - 1), 0.155], this.cache.steel(), 0.01);
      slat.rotation.x = -0.3;
    }
  }

  piston(parent: THREE.Object3D, a: V3, b: V3, radius = 0.07): void {
    const start = new THREE.Vector3(...a); const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const assembly = new THREE.Group();
    assembly.position.copy(start);
    assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    parent.add(assembly);
    const length = direction.length();
    this.cylinder(assembly, radius, length, [0, length / 2, 0], this.cache.steel());
    this.cylinder(assembly, radius * 1.6, length * 0.45, [0, length * 0.24, 0], this.cache.frame(this.team));
    this.cylinder(assembly, radius * 1.85, 0.075, [0, length * 0.46, 0], this.cache.hull(this.team));
  }
}

/** Static detailing is merged by material with the existing building, never one draw per bolt. */
export function detailBuilding(group: THREE.Group, kind: BuildingTypeId, cache: ResourceCache, team: Team, id: string): void {
  const m = new Machinery(cache, team, id);
  const dark = cache.frame(team); const hull = cache.hull(team); const glow = cache.glow(team, 1.4);
  if (kind === 'core') {
    for (let side = 0; side < 8; side++) {
      const face = new THREE.Group(); face.rotation.y = side * Math.PI / 4; group.add(face);
      for (const [width, height, y, z] of [[1.25, 0.85, 1.18, 2.54], [0.95, 0.78, 2.5, 2.02], [0.64, 0.7, 3.6, 1.48]]) {
        const panel = m.panel(face, width!, height!, [0, y!, z!]);
        panel.rotation.x = -0.2;
        m.box(panel, [width! * 0.37, 0.06, 0.04], [0, -height! * 0.3, 0.18], cache.hazard(), 0.01);
      }
      m.piston(face, [-0.55, 0.48, 2.76], [-0.43, 2.7, 1.94], 0.065);
      m.vent(face, 0.44, 0.42, [0, 0.49, 2.96]);
      m.box(face, [0.15, 0.65, 0.18], [0, 4.57, 1.07], hull);
      m.box(face, [0.06, 0.35, 0.04], [0, 4.6, 1.18], glow, 0.01);
    }
    return;
  }
  if (kind === 'wall' || kind === 'gate') {
    for (const x of kind === 'wall' ? [-1.9, 0, 1.9] : [-0.85, 0.85]) {
      m.box(group, [0.25, 1.5, 0.92], [x, 1.1, 0], dark, 0.05);
      for (const side of [-1, 1]) {
        m.panel(group, 0.28, 0.75, [x, 1.12, side * 0.48], side < 0 ? Math.PI : 0);
        m.box(group, [0.12, 0.12, 0.05], [x, 1.68, side * 0.49], glow, 0.01);
      }
    }
    return;
  }
  if (kind === 'relay' || kind === 'outpost' || kind === 'turret') {
    const tower = kind !== 'turret';
    for (let side = 0; side < 4; side++) {
      const face = new THREE.Group(); face.rotation.y = side * Math.PI / 2; group.add(face);
      m.panel(face, 0.6, 0.58, [0, 0.55, tower ? 0.95 : 0.79]);
      m.piston(face, [-0.43, 0.3, 0.83], [-0.32, 1.34, 0.53], 0.06);
      if (tower) {
        m.box(face, [0.25, 1.9, 0.25], [0.37, 2.6, 0.47], hull, 0.06);
        m.box(face, [0.08, 1.35, 0.08], [0.37, 2.6, 0.62], glow, 0.015);
        m.panel(face, 0.55, 0.35, [0, 3.84, 0.72]);
      }
    }
    return;
  }
  const dimensions: Partial<Record<BuildingTypeId, [number, number, number]>> = {
    fabricator: [3.4, 2.5, 2.35], foundry: [4.4, 3.5, 2.8], habitat: [2.6, 2.5, 1.85],
    depot: [2.8, 1.95, 1.45], reclaimer: [2.6, 2.6, 2.1], datalab: [2.6, 2.6, 2.1],
  };
  const dimensionsForKind = dimensions[kind];
  if (!dimensionsForKind) return;
  const [width, depth, top] = dimensionsForKind;
  for (const side of [-1, 1]) {
    for (const x of [-1, 1]) {
      const brace = m.box(group, [0.42, top * 0.82, 0.5], [x * width * 0.42, top * 0.53, side * depth * 0.48], hull, 0.09);
      brace.rotation.x = side * -0.16;
      m.panel(group, 0.47, 0.56, [x * width * 0.42, 0.52, side * (depth * 0.5 + 0.2)], side < 0 ? Math.PI : 0);
      m.piston(group, [x * width * 0.5, 0.35, side * depth * 0.47], [x * width * 0.48, top * 0.8, side * depth * 0.34], 0.065);
      m.box(group, [0.36, 0.14, 0.32], [x * width * 0.42, top + 0.12, side * depth * 0.43], dark, 0.035);
      m.cylinder(group, 0.045, 0.06, [x * width * 0.42, top + 0.23, side * depth * 0.43], cache.steel());
    }
    m.vent(group, depth * 0.46, 0.64, [side * (width / 2 + 0.03), top * 0.54, 0], side * Math.PI / 2);
    for (const z of [-0.3, 0.3]) m.box(group, [0.05, 0.35, 0.1], [side * (width / 2 + 0.15), top * 0.4, z], glow, 0.01);
    m.panel(group, width * 0.45, 0.35, [0, top * 0.75, side * (depth / 2 + 0.03)], side < 0 ? Math.PI : 0);
  }
  // Roof service hatch and raised cable conduits, visible from the RTS camera.
  const hatch = m.panel(group, width * 0.36, depth * 0.3, [0, top + 0.07, 0.22]);
  hatch.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    m.cylinder(group, 0.055, depth * 0.75, [side * width * 0.31, top + 0.17, 0], cache.steel(), 'z');
    for (const z of [-0.3, 0.3]) m.box(group, [0.18, 0.16, 0.14], [side * width * 0.31, top + 0.17, z], dark, 0.02);
  }
}
