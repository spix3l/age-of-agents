import * as THREE from 'three';
import type { EntityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';
import { MAP_BOUNDS, WORLD_OBSTACLES } from './map';

interface UnitVisual { readonly group: THREE.Group; readonly ring: THREE.Mesh }

export class WorldScene {
  readonly scene = new THREE.Scene();
  readonly ground: THREE.Mesh;
  readonly selectableMeshes: THREE.Object3D[] = [];
  private readonly units = new Map<EntityId, UnitVisual>();
  private readonly marker: THREE.Mesh;
  private markerLife = 0;

  constructor() {
    this.scene.background = new THREE.Color(0xa8c9c5);
    this.scene.fog = new THREE.Fog(0xa8c9c5, 58, 118);
    this.scene.add(new THREE.HemisphereLight(0xe6f5dc, 0x42522d, 2.2));
    const sun = new THREE.DirectionalLight(0xffe5b2, 3.7);
    sun.position.set(-28, 42, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    this.scene.add(sun);

    const terrain = new THREE.PlaneGeometry(MAP_BOUNDS.maxX - MAP_BOUNDS.minX, MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ, 36, 26);
    const terrainPositions = terrain.getAttribute('position');
    const colors: number[] = [];
    const color = new THREE.Color();
    for (let index = 0; index < terrainPositions.count; index += 1) {
      const shade = 0.82 + this.noise(index * 7 + 13) * 0.18;
      color.setRGB(0.34 * shade, 0.50 * shade, 0.19 * shade);
      colors.push(color.r, color.g, color.b);
    }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.ground = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.name = 'terrain';
    this.scene.add(this.ground);

    const grid = new THREE.GridHelper(72, 72, 0xbad689, 0x6f9148);
    grid.position.y = 0.015;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.055; });
    this.scene.add(grid);
    this.addPerimeterForest();
    this.addBoundaryCliffs();
    this.addTerrainDetails();
    WORLD_OBSTACLES.forEach((obstacle, index) => this.addObstacle(obstacle, index));

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.88, 24),
      new THREE.MeshBasicMaterial({ color: 0x73f7d3, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.08;
    this.scene.add(this.marker);
  }

  addUnit(unit: UnitEntity): void {
    const group = new THREE.Group();
    group.position.set(unit.position.x, 0, unit.position.z);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: unit.team === 'player' ? 0x20a9b7 : 0xc94c40, roughness: 0.48, metalness: 0.32 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x24353a, roughness: 0.68, metalness: 0.48 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.65, 6), bodyMaterial);
    body.position.y = 0.62; body.castShadow = true; body.userData.entityId = unit.id;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.48), darkMaterial);
    head.position.y = 1.08; head.castShadow = true; head.userData.entityId = unit.id;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.03), new THREE.MeshBasicMaterial({ color: unit.team === 'player' ? 0xbafff2 : 0xffd18c }));
    eye.position.set(0, 1.1, -0.25); eye.userData.entityId = unit.id;
    group.add(body, head, eye);
    [-0.32, 0.32].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), darkMaterial);
      leg.position.set(x, 0.24, 0); leg.castShadow = true; leg.userData.entityId = unit.id; group.add(leg);
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.67, 0.76, 24), new THREE.MeshBasicMaterial({ color: 0x80ffe5, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045; ring.visible = false; group.add(ring);
    this.scene.add(group);
    this.selectableMeshes.push(body, head, eye, ...group.children.filter((child) => child !== ring && child !== body && child !== head && child !== eye));
    this.units.set(unit.id, { group, ring });
  }

  syncUnits(units: readonly UnitEntity[], alpha: number): void {
    for (const unit of units) {
      const visual = this.units.get(unit.id);
      if (!visual) continue;
      visual.group.position.x = THREE.MathUtils.lerp(unit.previousPosition.x, unit.position.x, alpha);
      visual.group.position.z = THREE.MathUtils.lerp(unit.previousPosition.z, unit.position.z, alpha);
      visual.ring.visible = unit.selected;
      visual.group.visible = unit.alive;
    }
    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - 1 / 60);
      const material = this.marker.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(0.9, this.markerLife * 1.5);
      const scale = 1 + (0.8 - this.markerLife) * 0.7;
      this.marker.scale.setScalar(scale);
    }
  }

  showMoveMarker(x: number, z: number): void {
    this.marker.position.set(x, 0.08, z);
    this.marker.scale.setScalar(1);
    this.markerLife = 0.8;
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.scene.clear();
    this.units.clear();
  }

  private addObstacle(obstacle: (typeof WORLD_OBSTACLES)[number], index: number): void {
    const group = new THREE.Group();
    const rockMaterial = new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0x9a7950 : 0x796d52, roughness: 0.93, metalness: 0.03, flatShading: true });
    const pieces = Math.max(3, Math.round(obstacle.size.x));
    for (let part = 0; part < pieces; part += 1) {
      const geometry = new THREE.DodecahedronGeometry(1, 0);
      const rock = new THREE.Mesh(geometry, rockMaterial);
      const ratio = pieces === 1 ? 0 : part / (pieces - 1) - 0.5;
      rock.position.set(ratio * obstacle.size.x * 0.85, obstacle.height * (0.28 + (part % 3) * 0.08), Math.sin(part * 2.2) * obstacle.size.z * 0.25);
      rock.scale.set(1.3 + (part % 2) * 0.55, obstacle.height * 0.42, Math.max(1.4, obstacle.size.z * 0.2));
      rock.rotation.set(part * 0.13, part * 0.58, part * 0.09);
      rock.castShadow = true; rock.receiveShadow = true; group.add(rock);
    }
    group.position.set(obstacle.center.x, 0, obstacle.center.z);
    group.rotation.y = obstacle.rotation ?? 0;
    this.scene.add(group);
  }

  private addTerrainDetails(): void {
    const crystals = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x42c5be, emissive: 0x0b5653, emissiveIntensity: 0.6, roughness: 0.32, flatShading: true });
    const locations = [[-29, -17], [27, 17], [-28, 19], [29, -18]] as const;
    for (const [x, z] of locations) {
      for (let index = 0; index < 3; index += 1) {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8 + index * 0.45, 5), material);
        crystal.position.set(x + index * 0.55, 0.8 + index * 0.2, z + (index % 2) * 0.5);
        crystal.rotation.z = (index - 1) * 0.18; crystal.castShadow = true; crystals.add(crystal);
      }
    }
    this.scene.add(crystals);
    this.addMachineRuins();
  }

  private addPerimeterForest(): void {
    const count = 118;
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1.5, 5);
    const crownGeometry = new THREE.IcosahedronGeometry(0.9, 0);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4e3d28, roughness: 1, flatShading: true });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x315c2c, roughness: 0.96, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
    const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const tint = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const edge = index % 4;
      const along = this.noise(index * 5 + 1);
      const edgeOffset = -1.5 + this.noise(index * 5 + 2) * 3;
      if (edge < 2) position.set(MAP_BOUNDS.minX + along * 72, 0, edge === 0 ? MAP_BOUNDS.minZ + edgeOffset : MAP_BOUNDS.maxZ - edgeOffset);
      else position.set(edge === 2 ? MAP_BOUNDS.minX + edgeOffset : MAP_BOUNDS.maxX - edgeOffset, 0, MAP_BOUNDS.minZ + along * 52);
      const height = 0.8 + this.noise(index * 5 + 3) * 1.35;
      euler.set(0, this.noise(index * 5 + 4) * Math.PI * 2, 0);
      rotation.setFromEuler(euler);
      scale.set(0.75 * height, height, 0.75 * height);
      matrix.compose(new THREE.Vector3(position.x, 0.75 * height, position.z), rotation, scale);
      trunks.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(position.x, 2.05 * height, position.z), rotation, scale);
      crowns.setMatrixAt(index, matrix);
      tint.setHSL(0.25 + this.noise(index + 600) * 0.06, 0.42, 0.25 + this.noise(index + 700) * 0.12);
      crowns.setColorAt(index, tint);
    }
    trunks.castShadow = true; trunks.receiveShadow = true;
    crowns.castShadow = true; crowns.receiveShadow = true;
    this.scene.add(trunks, crowns);
  }

  private addBoundaryCliffs(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0xa67b45, roughness: 0.98, flatShading: true });
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const cliffs = new THREE.InstancedMesh(geometry, material, 30);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    for (let index = 0; index < 30; index += 1) {
      const north = index < 18;
      const x = north ? -36 + index * 4.3 : -35 + this.noise(index + 40) * 4;
      const z = north ? MAP_BOUNDS.minZ - 1.5 + this.noise(index + 50) : -26 + (index - 18) * 4.8;
      const height = 2.3 + this.noise(index + 70) * 2.2;
      rotation.setFromEuler(new THREE.Euler(this.noise(index) * 0.2, this.noise(index + 10) * Math.PI, 0));
      matrix.compose(new THREE.Vector3(x, height * 0.55, z), rotation, new THREE.Vector3(2.6, height, 2.8));
      cliffs.setMatrixAt(index, matrix);
    }
    cliffs.castShadow = true; cliffs.receiveShadow = true;
    this.scene.add(cliffs);
  }

  private addMachineRuins(): void {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x5d6657, roughness: 0.7, metalness: 0.45, flatShading: true });
    const glow = new THREE.MeshStandardMaterial({ color: 0x5dd7c3, emissive: 0x247d70, emissiveIntensity: 1.2 });
    const locations = [[-31, -5], [30, 6], [18, 21]] as const;
    for (const [x, z] of locations) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 0.6, 6), metal);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 3.2, 5), metal);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glow);
      base.position.set(x, 0.3, z); mast.position.set(x, 2, z); lamp.position.set(x, 3.7, z);
      base.castShadow = true; mast.castShadow = true; group.add(base, mast, lamp);
    }
    this.scene.add(group);
  }

  private noise(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
    return value - Math.floor(value);
  }
}
