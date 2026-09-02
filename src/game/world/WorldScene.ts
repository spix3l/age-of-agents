import * as THREE from 'three';
import type { EntityId } from '../types/ids';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';
import { BUILDINGS } from '../../data/buildings';
import type { PlaceableBuildingType } from '../building/PlacementController';
import { MAP_BOUNDS, MAP_SIZE, WORLD_OBSTACLES } from './map';
import { EffectsManager } from '../rendering/EffectsManager';
import { ResourceCache } from '../rendering/models/palette';
import { buildUnitModel, type UnitModel } from '../rendering/models/units';
import { buildBuildingModel, buildConstructionScaffold, type BuildingModel } from '../rendering/models/buildings';
import { buildResourceModel, type ResourceModel } from '../rendering/models/resources';

interface HealthBar { readonly group: THREE.Group; readonly fill: THREE.Mesh; readonly width: number }

interface UnitVisual {
  readonly group: THREE.Group;
  readonly ring: THREE.Mesh;
  readonly orderBeacon: THREE.Group;
  readonly health: HealthBar;
  readonly model: UnitModel;
  /** Walk-cycle phase, facing angle, and weapon recoil are per-unit animation state. */
  phase: number;
  yaw: number;
  /** Facing requested by combat, used when the unit is standing still and shooting. */
  aimYaw: number | null;
  recoil: number;
}

interface StaticVisual {
  readonly group: THREE.Group;
  readonly ring: THREE.Mesh;
  readonly model?: THREE.Group;
  readonly progress?: THREE.Mesh;
  readonly health?: HealthBar;
  readonly parts?: BuildingModel;
  readonly scaffold?: THREE.Group;
  readonly resource?: ResourceModel;
}

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
  private readonly cache = new ResourceCache();
  private readonly effects: EffectsManager;
  private readonly billboardQuaternion = new THREE.Quaternion();
  private readonly parentQuaternion = new THREE.Quaternion();

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

  showShot(from: Vec2, to: Vec2, team: Team, targetHeight = 0.9, attacker?: EntityId): void {
    this.effects.spawnShot(from, to, team, 1.05, targetHeight);
    this.effects.spawnImpact(to, team, targetHeight);
    const visual = attacker ? this.units.get(attacker) : undefined;
    if (!visual) return;
    // Kick the barrel and point the shooter at what it just hit.
    visual.recoil = 1;
    visual.aimYaw = Math.atan2(to.x - from.x, to.z - from.z) + Math.PI;
  }

  showDestruction(at: Vec2, team: Team, scale = 1): void {
    this.effects.spawnDeath(at, team, scale);
  }

  addUnit(unit: UnitEntity): void {
    const model = buildUnitModel(this.cache, unit.kind, unit.team, unit.id);
    const group = model.group;
    group.position.set(unit.position.x, 0, unit.position.z);

    const ring = new THREE.Mesh(
      this.cache.geometry('select-ring-unit', () => new THREE.RingGeometry(0.72, 0.82, 24)),
      this.cache.basic('select-ring-mat', { color: 0x80ffe5, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
    ring.visible = false;
    const orderBeacon = this.createOrderBeacon();
    const health = this.createHealthBar(1.15, 1.75);
    group.add(ring, orderBeacon, health.group);

    this.scene.add(group);
    this.selectableMeshes.push(...model.pickable);
    this.units.set(unit.id, { group, ring, orderBeacon, health, model, phase: 0, yaw: unit.team === 'player' ? 0 : Math.PI, aimYaw: null, recoil: 0 });
  }

  addBuilding(building: BuildingEntity): void {
    const group = new THREE.Group();
    group.position.set(building.position.x, 0, building.position.z);
    const parts = buildBuildingModel(this.cache, building.kind, building.team, building.id);
    const model = new THREE.Group();
    model.add(parts.group);

    const scaffold = buildConstructionScaffold(this.cache, building.kind, building.team);
    scaffold.visible = !building.operational;

    const radius = Math.max(building.footprint.x, building.footprint.z) / 2 + 0.4;
    const ring = new THREE.Mesh(
      this.cache.geometry(`select-ring-building-${radius.toFixed(1)}`, () => new THREE.RingGeometry(radius, radius + 0.2, 40)),
      this.cache.basic('select-ring-mat', { color: 0x80ffe5, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = false;

    const progress = new THREE.Mesh(
      this.cache.geometry(`progress-${building.footprint.x}`, () => new THREE.BoxGeometry(Math.max(1.4, building.footprint.x), 0.1, 0.18)),
      this.cache.basic('progress-mat', { color: 0x62efbd, depthTest: false }),
    );
    progress.position.set(0, 0.18, building.footprint.z / 2 + 0.35);
    progress.visible = !building.operational;
    progress.scale.x = Math.max(0.02, building.constructionProgress);

    const health = this.createHealthBar(Math.max(2, building.footprint.x), building.kind === 'core' ? 6 : building.kind === 'fabricator' ? 3.6 : 4.2);
    group.add(model, scaffold, ring, progress, health.group);
    this.scene.add(group);
    this.selectableMeshes.push(...parts.pickable);
    this.buildings.set(building.id, { group, ring, model, progress, health, parts, scaffold });
  }

  addResource(node: ResourceNodeEntity): void {
    const resource = buildResourceModel(this.cache, node.resourceType, node.id);
    const group = resource.group;
    group.position.set(node.position.x, 0, node.position.z);
    const isMatter = node.resourceType === 'matter';
    const ring = new THREE.Mesh(
      this.cache.geometry('select-ring-resource', () => new THREE.RingGeometry(2.05, 2.25, 32)),
      this.cache.basic(isMatter ? 'select-ring-matter' : 'select-ring-energy', {
        color: isMatter ? 0xffd783 : 0x79ffe8, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.visible = false;
    group.add(ring);
    this.scene.add(group);
    this.selectableMeshes.push(...resource.pickable);
    this.resources.set(node.id, { group, ring, resource });
  }

  syncUnits(units: readonly UnitEntity[], alpha: number): void {
    const frame = 1 / 60;
    this.animationTime += frame;
    for (const unit of units) {
      const visual = this.units.get(unit.id);
      if (!visual) continue;
      const x = THREE.MathUtils.lerp(unit.previousPosition.x, unit.position.x, alpha);
      const z = THREE.MathUtils.lerp(unit.previousPosition.z, unit.position.z, alpha);
      visual.group.position.x = x;
      visual.group.position.z = z;
      this.animateUnit(visual, unit, frame);
      if (unit.combat.targetId === null) visual.aimYaw = null;
      visual.ring.visible = unit.selected;
      visual.orderBeacon.visible = Boolean(unit.gatherOrder);
      if (unit.gatherOrder) {
        const color = unit.gatherOrder.resourceType === 'matter' ? 0xffca68 : 0x61f5df;
        for (const child of visual.orderBeacon.children) ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(color);
        visual.orderBeacon.rotation.y += 0.045;
        visual.orderBeacon.scale.setScalar(0.92 + Math.sin(this.animationTime * 6 + unit.position.x) * 0.12);
      }
      this.updateHealthBar(visual.health, unit.hp, unit.maxHp, unit.selected, unit.team);
      visual.group.visible = unit.alive;
    }
    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - frame);
      const material = this.marker.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(0.9, this.markerLife * 1.5);
      const baseScale = this.markerMode === 'move' ? 1 : 2;
      const duration = this.markerMode === 'move' ? 0.8 : 1.25;
      const scale = baseScale + (duration - this.markerLife) * (this.markerMode === 'rejected' ? 0.35 : 0.7);
      this.marker.scale.setScalar(scale);
    }
  }

  /** Turns simulation state into motion: facing, gait, cargo, turret tracking, and recoil. */
  private animateUnit(visual: UnitVisual, unit: UnitEntity, frame: number): void {
    const dx = unit.position.x - unit.previousPosition.x;
    const dz = unit.position.z - unit.previousPosition.z;
    const speed = Math.hypot(dx, dz) / Math.max(frame, 1e-4);
    const moving = speed > 0.05;

    // Face the direction of travel, or the current target when standing and shooting.
    let desiredYaw = visual.yaw;
    if (moving) desiredYaw = Math.atan2(dx, dz) + Math.PI;
    else if (visual.aimYaw !== null) desiredYaw = visual.aimYaw;
    visual.yaw = approachAngle(visual.yaw, desiredYaw, 7 * frame);
    visual.group.rotation.y = visual.yaw;

    // Gait: legs swing while walking, tracks bob slightly, everything settles when idle.
    visual.phase = moving ? visual.phase + Math.min(speed, 8) * frame * 3.2 : 0;
    visual.model.legs.forEach((leg, index) => {
      const swing = moving ? Math.sin(visual.phase + index * Math.PI) : 0;
      if (unit.kind === 'worker') {
        leg.rotation.x = swing * 0.55;
        leg.position.y = 0.5 + Math.abs(swing) * 0.05;
      } else {
        leg.position.y = 0.3 + swing * 0.03;
      }
    });
    if (unit.kind === 'worker') visual.group.position.y = moving ? Math.abs(Math.sin(visual.phase)) * 0.045 : 0;

    // Cargo pod fills with what the Worker is carrying.
    const cargo = visual.model.cargo;
    if (cargo) {
      const ratio = Math.max(0, Math.min(1, unit.cargo.amount / 10));
      cargo.visible = ratio > 0;
      cargo.scale.set(0.4 + ratio * 0.6, 0.4 + ratio * 0.6, 0.4 + ratio * 0.6);
      if (unit.cargo.type) {
        const material = (cargo as THREE.Mesh).material as THREE.MeshStandardMaterial;
        // Cargo material is shared per team, so tint a clone-free way: swap emissive intensity only.
        material.emissiveIntensity = 0.6 + ratio * 1.4;
      }
    }

    // Weapon recoil decays back to rest after each shot.
    visual.recoil = Math.max(0, visual.recoil - frame * 4);
    if (visual.model.barrel) visual.model.barrel.position.z = -0.3 + visual.recoil * 0.28;
    if (visual.model.optic) {
      const optic = (visual.model.optic as THREE.Mesh).material as THREE.MeshStandardMaterial;
      optic.emissiveIntensity = 1.6 + visual.recoil * 2.4;
    }
  }

  syncStructures(buildings: readonly BuildingEntity[], resources: readonly ResourceNodeEntity[]): void {
    const frame = 1 / 60;
    for (const building of buildings) {
      const visual = this.buildings.get(building.id);
      if (!visual) continue;
      visual.group.visible = building.alive;
      visual.ring.visible = building.selected;
      if (visual.model) visual.model.scale.y = building.operational ? 1 : 0.18 + building.constructionProgress * 0.82;
      if (visual.scaffold) visual.scaffold.visible = !building.operational;
      if (visual.progress) {
        visual.progress.visible = !building.operational;
        visual.progress.scale.x = Math.max(0.02, building.constructionProgress);
      }
      if (visual.health) this.updateHealthBar(visual.health, building.hp, building.maxHp, building.selected && building.operational, building.team, building.operational);
      if (!building.operational || !visual.parts) continue;

      // Orbit rings and dishes turn constantly; the Fabricator gantry only runs while working.
      visual.parts.spinners.forEach((spinner, index) => {
        spinner.rotation.z += (index % 2 === 0 ? 0.5 : -0.34) * frame;
        spinner.rotation.y += (index % 2 === 0 ? 0.18 : -0.26) * frame;
      });
      if (visual.parts.column) {
        const material = (visual.parts.column as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 1.8 + Math.sin(this.animationTime * 2.2 + building.position.x) * 0.5;
      }
      if (visual.parts.arm) {
        const working = building.productionQueue.length > 0;
        visual.parts.arm.visible = true;
        visual.parts.arm.position.x = working ? Math.sin(this.animationTime * 2.6) * 1.1 : 0;
        visual.parts.arm.position.y = 2.1 - (working ? Math.abs(Math.cos(this.animationTime * 2.6)) * 0.25 : 0);
      }
    }

    for (const node of resources) {
      const visual = this.resources.get(node.id);
      if (!visual) continue;
      visual.group.visible = node.alive;
      visual.ring.visible = node.selected;
      // A depleted deposit visibly shrinks toward its bed.
      const remaining = Math.max(0.28, node.remaining / node.capacity);
      visual.resource?.shards.forEach((shard, index) => {
        shard.scale.setScalar(0.55 + remaining * 0.45);
        if (node.resourceType === 'energy') {
          shard.position.y = (index === visual.resource!.shards.length - 1 ? 0.35 : 1.05) + Math.sin(this.animationTime * 1.6 + index) * 0.06;
          shard.rotation.y += 0.15 * frame * (index % 2 === 0 ? 1 : -1);
        }
      });
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

  /**
   * Removes an entity's visual. Geometry and materials belong to the shared cache and are
   * disposed once in dispose(), never per entity, because every Agent of a kind reuses them.
   */
  private disposeGroup(group: THREE.Group, id: EntityId): void {
    this.scene.remove(group);
    for (let index = this.selectableMeshes.length - 1; index >= 0; index -= 1) {
      if (this.selectableMeshes[index]?.userData.entityId === id) this.selectableMeshes.splice(index, 1);
    }
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
    this.cache.dispose();
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
    // Units now rotate to face their heading, so cancel the parent's rotation before
    // applying the camera-facing quaternion or the bar would turn with the chassis.
    bar.group.parent?.getWorldQuaternion(this.parentQuaternion);
    bar.group.quaternion.copy(this.parentQuaternion.invert()).multiply(this.billboardQuaternion);
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

/** Shortest-path rotation toward a target angle, so units never spin the long way round. */
function approachAngle(current: number, target: number, maxStep: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}
