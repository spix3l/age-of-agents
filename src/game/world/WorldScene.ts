import * as THREE from 'three';
import type { EntityId } from '../types/ids';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';
import { BUILDINGS } from '../../data/buildings';
import type { PlaceableBuildingType } from '../building/PlacementController';
import { MAP_BOUNDS, MAP_SIZE, WORLD_OBSTACLES } from './map';
import { EffectsManager } from '../rendering/EffectsManager';

interface HealthBar { readonly group: THREE.Group; readonly fill: THREE.Mesh; readonly width: number }
interface UnitVisual { readonly group: THREE.Group; readonly ring: THREE.Mesh; readonly orderBeacon: THREE.Group; readonly health: HealthBar }
interface StaticVisual { readonly group: THREE.Group; readonly ring: THREE.Mesh; readonly model?: THREE.Group; readonly progress?: THREE.Mesh; readonly health?: HealthBar }

export class WorldScene {
  readonly scene = new THREE.Scene();
  readonly ground: THREE.Mesh;
  readonly selectableMeshes: THREE.Object3D[] = [];
  private readonly units = new Map<EntityId, UnitVisual>();
  private readonly buildings = new Map<EntityId, StaticVisual>();
  private readonly resources = new Map<EntityId, StaticVisual>();
  private readonly marker: THREE.Mesh;
  private markerLife = 0;
  private markerMode: 'move' | 'gather' | 'rejected' = 'move';
  private animationTime = 0;
  private placementGhost: THREE.Group | null = null;
  private placementGhostType: PlaceableBuildingType | null = null;
  private readonly sun: THREE.DirectionalLight;
  private readonly effects: EffectsManager;
  private readonly billboardQuaternion = new THREE.Quaternion();

  constructor() {
    this.scene.background = new THREE.Color(0xa8c9c5);
    this.scene.fog = new THREE.Fog(0xa8c9c5, 58, 118);
    this.scene.add(new THREE.HemisphereLight(0xe6f5dc, 0x42522d, 2.2));
    this.sun = new THREE.DirectionalLight(0xffe5b2, 3.7);
    this.sun.position.set(-28, 42, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    // The shadow frustum stays tight and travels with the camera, so a large map keeps
    // crisp shadows instead of stretching one huge low-resolution map across it.
    this.sun.shadow.camera.left = -34; this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 30; this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.far = 160;
    this.scene.add(this.sun, this.sun.target);

    const terrain = new THREE.PlaneGeometry(MAP_SIZE.width, MAP_SIZE.depth, Math.round(MAP_SIZE.width / 2), Math.round(MAP_SIZE.depth / 2));
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

    const grid = new THREE.GridHelper(Math.max(MAP_SIZE.width, MAP_SIZE.depth), Math.max(MAP_SIZE.width, MAP_SIZE.depth), 0xbad689, 0x6f9148);
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
    this.effects = new EffectsManager(this.scene);
  }

  /** Advances presentation-only state: pooled combat effects and camera-facing indicators. */
  updatePresentation(frameDelta: number, view: THREE.Object3D, focus?: THREE.Vector3): void {
    this.effects.update(frameDelta);
    view.getWorldQuaternion(this.billboardQuaternion);
    if (!focus) return;
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x - 28, 46, focus.z + 22);
    this.sun.target.updateMatrixWorld();
  }

  get effectCounters(): { readonly active: number; readonly pooled: number; readonly created: number; readonly dropped: number } {
    return { active: this.effects.activeCount, pooled: this.effects.pooledCount, created: this.effects.createdCount, dropped: this.effects.droppedCount };
  }

  showShot(from: Vec2, to: Vec2, team: Team, targetHeight = 0.9): void {
    this.effects.spawnShot(from, to, team, 1.05, targetHeight);
    this.effects.spawnImpact(to, team, targetHeight);
  }

  showDestruction(at: Vec2, team: Team, scale = 1): void {
    this.effects.spawnDeath(at, team, scale);
  }

  addUnit(unit: UnitEntity): void {
    const group = new THREE.Group();
    group.position.set(unit.position.x, 0, unit.position.z);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: unit.team === 'player' ? 0x20a9b7 : 0xc94c40, roughness: 0.48, metalness: 0.32 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x24353a, roughness: 0.68, metalness: 0.48 });
    const body = new THREE.Mesh(unit.kind === 'striker' ? new THREE.BoxGeometry(1.15, 0.5, 1.35) : new THREE.CylinderGeometry(0.46, 0.56, 0.65, 6), bodyMaterial);
    body.position.y = unit.kind === 'striker' ? 0.55 : 0.62; body.castShadow = true; body.userData.entityId = unit.id;
    const head = new THREE.Mesh(unit.kind === 'striker' ? new THREE.CylinderGeometry(0.28, 0.42, 0.42, 6) : new THREE.BoxGeometry(0.58, 0.38, 0.48), darkMaterial);
    head.position.y = unit.kind === 'striker' ? 1.02 : 1.08; head.castShadow = true; head.userData.entityId = unit.id;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.03), new THREE.MeshBasicMaterial({ color: unit.team === 'player' ? 0xbafff2 : 0xffd18c }));
    eye.position.set(0, unit.kind === 'striker' ? 1.04 : 1.1, unit.kind === 'striker' ? -0.7 : -0.25); eye.userData.entityId = unit.id;
    group.add(body, head, eye);
    [-0.32, 0.32].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), darkMaterial);
      leg.position.set(unit.kind === 'striker' ? x * 1.55 : x, 0.24, 0); leg.castShadow = true; leg.userData.entityId = unit.id; group.add(leg);
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.67, 0.76, 24), new THREE.MeshBasicMaterial({ color: 0x80ffe5, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045; ring.visible = false; group.add(ring);
    const orderBeacon = this.createOrderBeacon();
    group.add(orderBeacon);
    const health = this.createHealthBar(1.15, 1.55);
    group.add(health.group);
    this.scene.add(group);
    this.selectableMeshes.push(body, head, eye, ...group.children.filter((child) => child !== ring && child !== body && child !== head && child !== eye && child !== health.group && child !== orderBeacon));
    this.units.set(unit.id, { group, ring, orderBeacon, health });
  }

  addBuilding(building: BuildingEntity): void {
    const group = new THREE.Group();
    const model = new THREE.Group();
    group.position.set(building.position.x, 0, building.position.z);
    const teamColor = building.team === 'player' ? 0x1d8f9c : 0xb94b3d;
    const shell = new THREE.MeshStandardMaterial({ color: 0xd7d2b9, roughness: 0.62, metalness: 0.18, flatShading: true });
    const metal = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.4, metalness: 0.5, flatShading: true });
    const baseGeometry = building.kind === 'fabricator' ? new THREE.BoxGeometry(3.8, 0.8, 2.8) : building.kind === 'relay' ? new THREE.CylinderGeometry(0.95, 1.2, 0.7, 6) : new THREE.CylinderGeometry(2.35, 2.7, 1.1, 8);
    const towerGeometry = building.kind === 'fabricator' ? new THREE.BoxGeometry(2.8, 1.7, 2.1) : building.kind === 'relay' ? new THREE.CylinderGeometry(0.22, 0.38, 2.7, 6) : new THREE.CylinderGeometry(1.25, 1.75, 3.1, 8);
    const base = new THREE.Mesh(baseGeometry, metal);
    base.position.y = 0.55; base.castShadow = true; base.receiveShadow = true; base.userData.entityId = building.id;
    const tower = new THREE.Mesh(towerGeometry, shell);
    tower.position.y = building.kind === 'relay' ? 1.75 : building.kind === 'fabricator' ? 1.5 : 2.05; tower.castShadow = true; tower.userData.entityId = building.id;
    const crown = new THREE.Mesh(building.kind === 'fabricator' ? new THREE.CylinderGeometry(0.65, 0.85, 0.7, 6) : new THREE.OctahedronGeometry(building.kind === 'relay' ? 0.62 : 1.05, 0), metal);
    crown.position.y = building.kind === 'relay' ? 3.25 : building.kind === 'fabricator' ? 2.75 : 4.05; crown.rotation.y = Math.PI / 4; crown.castShadow = true; crown.userData.entityId = building.id;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(building.kind === 'relay' ? 0.18 : 0.48, building.kind === 'relay' ? 0.18 : 0.48, building.kind === 'relay' ? 1.8 : 2.2, 8), new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 1.4 }));
    glow.position.y = building.kind === 'relay' ? 1.8 : 2.2; glow.userData.entityId = building.id;
    const radius = Math.max(building.footprint.x, building.footprint.z) / 2 + 0.4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.2, 40), new THREE.MeshBasicMaterial({ color: 0x80ffe5, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false;
    model.add(base, tower, crown, glow);
    const progress = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.4, building.footprint.x), 0.1, 0.18), new THREE.MeshBasicMaterial({ color: 0x62efbd, depthTest: false }));
    progress.position.set(0, 0.18, building.footprint.z / 2 + 0.35);
    progress.visible = !building.operational;
    progress.scale.x = Math.max(0.02, building.constructionProgress);
    const health = this.createHealthBar(Math.max(2, building.footprint.x), building.kind === 'core' ? 5.2 : building.kind === 'fabricator' ? 3.6 : 4);
    group.add(model, ring, progress, health.group);
    this.scene.add(group);
    this.selectableMeshes.push(base, tower, crown, glow);
    this.buildings.set(building.id, { group, ring, model, progress, health });
  }

  addResource(node: ResourceNodeEntity): void {
    const group = new THREE.Group();
    group.position.set(node.position.x, 0, node.position.z);
    const isMatter = node.resourceType === 'matter';
    const material = new THREE.MeshStandardMaterial({
      color: isMatter ? 0xc49a54 : 0x4cc7b8,
      emissive: isMatter ? 0x4e3210 : 0x0d5853,
      emissiveIntensity: isMatter ? 0.12 : 0.65,
      roughness: isMatter ? 0.78 : 0.28,
      metalness: isMatter ? 0.32 : 0.12,
      flatShading: true,
    });
    const count = isMatter ? 6 : 5;
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(
        isMatter ? new THREE.DodecahedronGeometry(0.72 + (index % 3) * 0.18, 0) : new THREE.ConeGeometry(0.5, 2 + index * 0.22, 5),
        material,
      );
      const angle = (index / count) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 0.9, isMatter ? 0.55 : 0.9 + index * 0.08, Math.sin(angle) * 0.9);
      mesh.rotation.set(index * 0.13, angle, isMatter ? index * 0.08 : (index - 2) * 0.08);
      mesh.castShadow = true; mesh.userData.entityId = node.id; group.add(mesh); this.selectableMeshes.push(mesh);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.72, 32), new THREE.MeshBasicMaterial({ color: isMatter ? 0xffd783 : 0x79ffe8, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; group.add(ring);
    this.scene.add(group);
    this.resources.set(node.id, { group, ring });
  }

  syncUnits(units: readonly UnitEntity[], alpha: number): void {
    this.animationTime += 1 / 60;
    for (const unit of units) {
      const visual = this.units.get(unit.id);
      if (!visual) continue;
      visual.group.position.x = THREE.MathUtils.lerp(unit.previousPosition.x, unit.position.x, alpha);
      visual.group.position.z = THREE.MathUtils.lerp(unit.previousPosition.z, unit.position.z, alpha);
      visual.ring.visible = unit.selected;
      visual.orderBeacon.visible = Boolean(unit.gatherOrder);
      if (unit.gatherOrder) {
        const color = unit.gatherOrder.resourceType === 'matter' ? 0xffca68 : 0x61f5df;
        for (const child of visual.orderBeacon.children) ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(color);
        visual.orderBeacon.rotation.y += 0.045;
        const pulse = 0.92 + Math.sin(this.animationTime * 6 + unit.position.x) * 0.12;
        visual.orderBeacon.scale.setScalar(pulse);
      }
      this.updateHealthBar(visual.health, unit.hp, unit.maxHp, unit.selected, unit.team);
      visual.group.visible = unit.alive;
    }
    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - 1 / 60);
      const material = this.marker.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(0.9, this.markerLife * 1.5);
      const baseScale = this.markerMode === 'move' ? 1 : 2;
      const duration = this.markerMode === 'move' ? 0.8 : 1.25;
      const scale = baseScale + (duration - this.markerLife) * (this.markerMode === 'rejected' ? 0.35 : 0.7);
      this.marker.scale.setScalar(scale);
    }
  }

  syncStructures(buildings: readonly BuildingEntity[], resources: readonly ResourceNodeEntity[]): void {
    for (const building of buildings) {
      const visual = this.buildings.get(building.id);
      if (!visual) continue;
      visual.group.visible = building.alive;
      visual.ring.visible = building.selected;
      if (visual.model) visual.model.scale.y = building.operational ? 1 : 0.18 + building.constructionProgress * 0.82;
      if (visual.progress) {
        visual.progress.visible = !building.operational;
        visual.progress.scale.x = Math.max(0.02, building.constructionProgress);
      }
      if (visual.health) this.updateHealthBar(visual.health, building.hp, building.maxHp, building.selected && building.operational, building.team, building.operational);
    }
    for (const node of resources) {
      const visual = this.resources.get(node.id);
      if (!visual) continue;
      visual.group.visible = node.alive;
      visual.ring.visible = node.selected;
      const scale = Math.max(0.35, node.remaining / node.capacity);
      visual.group.scale.setScalar(0.72 + scale * 0.28);
    }
  }

  showMoveMarker(x: number, z: number): void {
    this.markerMode = 'move';
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(0x73f7d3);
    this.marker.position.set(x, 0.08, z);
    this.marker.scale.setScalar(1);
    this.markerLife = 0.8;
  }

  showGatherMarker(x: number, z: number, type: ResourceNodeEntity['resourceType']): void {
    this.markerMode = 'gather';
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(type === 'matter' ? 0xffca68 : 0x61f5df);
    this.marker.position.set(x, 0.1, z);
    this.marker.scale.setScalar(2);
    this.markerLife = 1.25;
  }

  showRejectedMarker(x: number, z: number): void {
    this.markerMode = 'rejected';
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(0xff665c);
    this.marker.position.set(x, 0.1, z);
    this.marker.scale.setScalar(2);
    this.markerLife = 1.25;
  }

  showAttackMarker(x: number, z: number): void {
    this.markerMode = 'gather';
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(0xff8a4c);
    this.marker.position.set(x, 0.1, z);
    this.marker.scale.setScalar(1.6);
    this.markerLife = 1;
  }

  showPlacementGhost(type: PlaceableBuildingType, x: number, z: number, valid: boolean): void {
    if (!this.placementGhost || this.placementGhostType !== type) {
      this.removePlacementGhost();
      const config = BUILDINGS[type];
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({ color: 0x63efbd, transparent: true, opacity: 0.38, depthWrite: false });
      const footprint = new THREE.Mesh(new THREE.BoxGeometry(config.footprint[0], 0.08, config.footprint[1]), material);
      footprint.position.y = 0.07;
      const mass = new THREE.Mesh(new THREE.BoxGeometry(config.footprint[0] * 0.72, type === 'relay' ? 2.2 : 2.8, config.footprint[1] * 0.7), material);
      mass.position.y = type === 'relay' ? 1.15 : 1.45;
      const crown = new THREE.Mesh(type === 'relay' ? new THREE.OctahedronGeometry(0.55, 0) : new THREE.CylinderGeometry(0.7, 0.95, 0.7, 6), material);
      crown.position.y = type === 'relay' ? 2.65 : 3.05;
      group.add(footprint, mass, crown);
      this.scene.add(group);
      this.placementGhost = group;
      this.placementGhostType = type;
    }
    this.placementGhost.position.set(x, 0, z);
    for (const child of this.placementGhost.children) {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.color.setHex(valid ? 0x63efbd : 0xff665c);
      material.opacity = valid ? 0.42 : 0.58;
      material.wireframe = !valid;
    }
    this.placementGhost.visible = true;
  }

  hidePlacementGhost(): void { if (this.placementGhost) this.placementGhost.visible = false; }

  removeUnit(id: EntityId): void {
    const visual = this.units.get(id);
    if (!visual) return;
    this.disposeGroup(visual.group, id);
    this.units.delete(id);
  }

  removeBuilding(id: EntityId): void {
    const visual = this.buildings.get(id);
    if (!visual) return;
    this.disposeGroup(visual.group, id);
    this.buildings.delete(id);
  }

  private disposeGroup(group: THREE.Group, id: EntityId): void {
    this.scene.remove(group);
    for (let index = this.selectableMeshes.length - 1; index >= 0; index -= 1) {
      if (this.selectableMeshes[index]?.userData.entityId === id) this.selectableMeshes.splice(index, 1);
    }
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }

  dispose(): void {
    this.effects.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.scene.clear();
    this.units.clear();
    this.buildings.clear();
    this.resources.clear();
    this.placementGhost = null;
    this.placementGhostType = null;
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

  private createHealthBar(width: number, height: number): HealthBar {
    const group = new THREE.Group();
    group.position.y = height;
    group.visible = false;
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x101a1c, transparent: true, opacity: 0.72, depthTest: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x63efbd, depthTest: false }),
    );
    fill.position.z = 0.001;
    background.renderOrder = 10;
    fill.renderOrder = 11;
    group.add(background, fill);
    return { group, fill, width };
  }

  private updateHealthBar(bar: HealthBar, hp: number, maxHp: number, forceVisible: boolean, team: Team, allowed = true): void {
    const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
    const visible = allowed && (forceVisible || ratio < 0.999);
    bar.group.visible = visible;
    if (!visible) return;
    bar.group.quaternion.copy(this.billboardQuaternion);
    bar.fill.scale.x = Math.max(0.001, ratio);
    bar.fill.position.x = -(bar.width * (1 - ratio)) / 2;
    const material = bar.fill.material as THREE.MeshBasicMaterial;
    material.color.setHex(team === 'player' ? (ratio > 0.35 ? 0x63efbd : 0xffb257) : ratio > 0.35 ? 0xff8a6a : 0xffd18c);
  }

  private createOrderBeacon(): THREE.Group {
    const group = new THREE.Group();
    group.position.y = 1.72;
    group.visible = false;
    const material = new THREE.MeshBasicMaterial({ color: 0xffca68, transparent: true, opacity: 0.95, depthTest: false });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), material);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 5, 16), material);
    halo.rotation.x = Math.PI / 2;
    group.add(diamond, halo);
    return group;
  }

  private removePlacementGhost(): void {
    if (!this.placementGhost) return;
    this.scene.remove(this.placementGhost);
    this.placementGhost.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.placementGhost = null;
  }

  private addTerrainDetails(): void {
    this.addMachineRuins();
  }

  private addPerimeterForest(): void {
    const count = 210;
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
      if (edge < 2) position.set(MAP_BOUNDS.minX + along * MAP_SIZE.width, 0, edge === 0 ? MAP_BOUNDS.minZ + edgeOffset : MAP_BOUNDS.maxZ - edgeOffset);
      else position.set(edge === 2 ? MAP_BOUNDS.minX + edgeOffset : MAP_BOUNDS.maxX - edgeOffset, 0, MAP_BOUNDS.minZ + along * MAP_SIZE.depth);
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
    const northCount = Math.round(MAP_SIZE.width / 4.3);
    const westCount = Math.round(MAP_SIZE.depth / 4.8);
    const total = northCount + westCount;
    const cliffs = new THREE.InstancedMesh(geometry, material, total);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    for (let index = 0; index < total; index += 1) {
      const north = index < northCount;
      const x = north ? MAP_BOUNDS.minX + index * 4.3 : MAP_BOUNDS.minX + 1 + this.noise(index + 40) * 4;
      const z = north ? MAP_BOUNDS.minZ - 1.5 + this.noise(index + 50) : MAP_BOUNDS.minZ + (index - northCount) * 4.8;
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
    const locations = [[-52, -4], [51, 5], [24, 34], [-25, -35], [2, 2]] as const;
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
