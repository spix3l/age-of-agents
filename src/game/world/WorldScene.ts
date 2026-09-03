import * as THREE from 'three';
import type { EntityId } from '../types/ids';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';
import type { Generation } from '../types/simulation';
import { BUILDINGS } from '../../data/buildings';
import type { PlaceableBuildingType } from '../building/PlacementController';
import { MAP_SIZE } from './map';
import { Environment } from './environment';
import { EffectsManager } from '../rendering/EffectsManager';
import { ResourceCache } from '../rendering/models/palette';
import { buildUnitModel, type UnitModel } from '../rendering/models/units';
import { buildBuildingModel, buildConstructionScaffold, type BuildingModel } from '../rendering/models/buildings';
import { buildResourceModel, type ResourceModel } from '../rendering/models/resources';
import type { VisionSnapshot } from '../vision/VisionSystem';

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

/** Sun direction relative to the camera focus: high, from the right and behind, so
 * shadows fall toward the viewer's lower-left the way the reference diorama lights its valley. */
const SUN_OFFSET = Object.freeze({ x: 30, y: 54, z: -22 });
/** Fog-of-war alpha: unexplored is dark but never black, explored is a dusk tint. */
const FOG_UNKNOWN = 178;
const FOG_EXPLORED = 92;

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
  private readonly ghostMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x63efbd, transparent: true, opacity: 0.45, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x63efbd, transparent: true, opacity: 0.3, depthWrite: false }),
  ];
  private readonly sun: THREE.DirectionalLight;
  private readonly cache = new ResourceCache();
  private readonly environment: Environment;
  private readonly effects: EffectsManager;
  private readonly billboardQuaternion = new THREE.Quaternion();
  private readonly parentQuaternion = new THREE.Quaternion();
  private readonly generations = new Map<Exclude<Team, 'neutral'>, Generation>([['player', 1], ['enemy', 1]]);
  private readonly hiddenEntities = new Set<EntityId>();
  /** Structures mid-growth-pop after an evolution, keyed to elapsed seconds of the animation. */
  private readonly growing = new Map<StaticVisual, { elapsed: number; readonly parts: THREE.Object3D[] }>();
  private readonly fogTexture: THREE.DataTexture;
  private readonly fogPixels: Uint8Array;

  constructor() {
    // The canvas is transparent: the sky gradient behind it shows above the horizon, and
    // distance fog fades the far hills into the same pale blue.
    this.scene.background = new THREE.Color(0x13202a);
    this.scene.fog = new THREE.Fog(0x13202a, 160, 420);
    this.scene.add(new THREE.HemisphereLight(0xa9cde3, 0x33452e, 1.0));
    this.scene.add(new THREE.AmbientLight(0xbfd6e6, 0.3));
    this.sun = new THREE.DirectionalLight(0xffe9cc, 2.1);
    this.sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = 0.0006;
    this.sun.shadow.normalBias = 0.08;
    // The shadow frustum stays tight and travels with the camera, so a large map keeps
    // crisp shadows instead of stretching one huge low-resolution map across it.
    this.sun.shadow.camera.left = -38; this.sun.shadow.camera.right = 38;
    this.sun.shadow.camera.top = 34; this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.scene.add(this.sun, this.sun.target);

    this.environment = new Environment();
    this.scene.add(this.environment.group);
    this.ground = this.environment.terrain;

    const fogWidth = Math.ceil(MAP_SIZE.width / 4);
    const fogHeight = Math.ceil(MAP_SIZE.depth / 4);
    this.fogPixels = new Uint8Array(fogWidth * fogHeight * 4);
    for (let index = 0; index < fogWidth * fogHeight; index += 1) {
      const offset = index * 4;
      this.fogPixels[offset] = FOG_UNKNOWN;
      this.fogPixels[offset + 1] = FOG_UNKNOWN;
      this.fogPixels[offset + 2] = FOG_UNKNOWN;
      this.fogPixels[offset + 3] = 255;
    }
    this.fogTexture = new THREE.DataTexture(this.fogPixels, fogWidth, fogHeight, THREE.RGBAFormat);
    // PlaneGeometry's V axis maps to negative world Z after the isometric ground rotation.
    this.fogTexture.flipY = true;
    this.fogTexture.magFilter = THREE.LinearFilter;
    this.fogTexture.minFilter = THREE.LinearFilter;
    this.fogTexture.needsUpdate = true;
    const fogPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE.width, MAP_SIZE.depth),
      // Drawn as a screen overlay after the world, so grass, mesas, and trees inside the
      // unexplored region are dimmed with the ground instead of poking through it.
      new THREE.MeshBasicMaterial({ alphaMap: this.fogTexture, transparent: true, depthWrite: false, depthTest: false, color: 0x0a1116 }),
    );
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.12;
    fogPlane.renderOrder = 5;
    fogPlane.name = 'fog-of-war';
    this.scene.add(fogPlane);

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
  updatePresentation(frameDelta: number, view: THREE.Object3D, focus?: THREE.Vector3, zoom = 1): void {
    this.effects.update(frameDelta);
    view.getWorldQuaternion(this.billboardQuaternion);
    if (!focus) return;
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x + SUN_OFFSET.x, SUN_OFFSET.y, focus.z + SUN_OFFSET.z);
    this.sun.target.updateMatrixWorld();
    // The frustum tracks the visible area so a wide view still casts shadows at its edges.
    const half = THREE.MathUtils.clamp(38 / zoom, 38, 130);
    if (Math.abs(this.sun.shadow.camera.right - half) > 1) {
      this.sun.shadow.camera.left = -half; this.sun.shadow.camera.right = half;
      this.sun.shadow.camera.top = half * 0.88; this.sun.shadow.camera.bottom = -half * 0.88;
      this.sun.shadow.camera.updateProjectionMatrix();
    }
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

  /** A short pooled pulse makes a Titan rollout feel weighty without adding particles forever. */
  showHeavyArrival(at: Vec2, team: Team): void {
    this.effects.spawnDeath(at, team, 1.65);
    this.effects.spawnImpact(at, team, 1.4);
  }

  setGeneration(team: Exclude<Team, 'neutral'>, generation: Generation): void {
    this.generations.set(team, generation);
    for (const visual of this.buildings.values()) {
      if (visual.group.userData.team !== team || !visual.parts) continue;
      const grew: THREE.Object3D[] = [];
      for (const entry of visual.parts.generationParts) {
        const visible = generation >= entry.min;
        if (visible && !entry.part.visible) grew.push(entry.part);
        entry.part.visible = visible;
      }
      // Every structure that actually gained mass announces it, so an evolution is felt
      // across the whole colony instead of only on the Core that paid for it.
      if (grew.length > 0) {
        for (const part of grew) part.scale.setScalar(0.2);
        this.growing.set(visual, { elapsed: 0, parts: grew });
        this.effects.spawnDeath({ x: visual.group.position.x, z: visual.group.position.z }, team, 1.4);
      }
    }
  }

  /** Drives the pop-in of structure added by an evolution. Purely presentational. */
  private advanceGrowth(delta: number): void {
    for (const [visual, state] of this.growing) {
      state.elapsed += delta;
      const progress = Math.min(1, state.elapsed / 0.6);
      const scale = progress >= 1 ? 1 : THREE.MathUtils.lerp(0.2, 1, progress) + Math.sin(progress * Math.PI) * 0.16;
      for (const part of state.parts) part.scale.setScalar(scale);
      if (progress >= 1) this.growing.delete(visual);
    }
  }

  setEntityVisible(id: EntityId, visible: boolean): void {
    if (visible) this.hiddenEntities.delete(id); else this.hiddenEntities.add(id);
  }

  updateFog(snapshot: VisionSnapshot): void {
    const cells = Math.min(snapshot.states.length, this.fogPixels.length / 4);
    for (let index = 0; index < cells; index += 1) {
      const state = snapshot.states[index];
      const offset = index * 4;
      const opacity = state === 2 ? 0 : state === 1 ? FOG_EXPLORED : FOG_UNKNOWN;
      // Alpha maps sample the green channel. Mirroring into RGB keeps this
      // portable across WebGL implementations and texture swizzles.
      this.fogPixels[offset] = opacity;
      this.fogPixels[offset + 1] = opacity;
      this.fogPixels[offset + 2] = opacity;
      this.fogPixels[offset + 3] = 255;
    }
    this.fogTexture.needsUpdate = true;
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
    group.userData.team = building.team;
    const parts = buildBuildingModel(this.cache, building.kind, building.team, building.id);
    if (building.team !== 'neutral') {
      const generation = this.generations.get(building.team) ?? 1;
      for (const entry of parts.generationParts) entry.part.visible = generation >= entry.min;
    }
    const model = new THREE.Group();
    model.add(parts.group);
    if (building.rotated) model.rotation.y = Math.PI / 2;

    const scaffold = buildConstructionScaffold(this.cache, building.kind, building.team);
    scaffold.visible = !building.operational;

    // A trodden soil yard grounds each structure in the meadow; walls and gates sit flush.
    if (building.kind !== 'wall' && building.kind !== 'gate') {
      const yard = new THREE.Mesh(
        this.cache.roundedBox(`yard-${building.footprint.x}-${building.footprint.z}`, building.footprint.x + 0.7, 0.08, building.footprint.z + 0.7, 0.04),
        this.cache.standard('yard-soil', { color: 0x4a5057, roughness: 0.95, metalness: 0.05 }),
      );
      yard.position.y = 0.02;
      yard.receiveShadow = true;
      group.add(yard);
    }

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
    const isData = node.resourceType === 'data';
    const ring = new THREE.Mesh(
      this.cache.geometry('select-ring-resource', () => new THREE.RingGeometry(2.05, 2.25, 32)),
      this.cache.basic(isMatter ? 'select-ring-matter' : isData ? 'select-ring-data' : 'select-ring-energy', {
        color: isMatter ? 0xffd783 : isData ? 0xc9a8ff : 0x79ffe8, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
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
      visual.group.visible = unit.alive && !this.hiddenEntities.has(unit.id);
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

    // Gait: legs swing while walking, arms counter-swing, everything settles when idle.
    visual.phase = moving ? visual.phase + Math.min(speed, 8) * frame * 3.4 : 0;
    const walker = unit.kind !== 'scout';
    visual.model.legs.forEach((leg, index) => {
      const swing = moving ? Math.sin(visual.phase + index * Math.PI) : 0;
      if (!walker) { leg.rotation.z += frame * 2.2; return; }
      const stride = unit.kind === 'titan' ? 0.2 : unit.kind === 'ranger' ? 0.45 : 0.6;
      leg.rotation.x = swing * stride;
      const rest = typeof leg.userData.restY === 'number' ? leg.userData.restY : leg.position.y;
      leg.position.y = rest + Math.max(0, swing) * 0.05;
    });
    visual.model.arms.forEach((arm, index) => {
      const swing = moving ? Math.sin(visual.phase + index * Math.PI + Math.PI) : 0;
      arm.rotation.x = unit.kind === 'worker' ? swing * 0.5 : swing * 0.12;
    });
    if (walker) visual.group.position.y = moving ? Math.abs(Math.sin(visual.phase)) * (unit.kind === 'titan' ? 0.03 : 0.05) : 0;
    if (visual.model.hover) visual.model.hover.position.y = 1.15 + Math.sin(this.animationTime * 3 + unit.position.x) * 0.12;

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
    this.advanceGrowth(frame);
    for (const building of buildings) {
      const visual = this.buildings.get(building.id);
      if (!visual) continue;
      visual.group.visible = building.alive && !this.hiddenEntities.has(building.id);
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
        const rest = typeof visual.parts.arm.userData.restY === 'number' ? visual.parts.arm.userData.restY : visual.parts.arm.position.y;
        visual.parts.arm.position.y = rest - (working ? Math.abs(Math.cos(this.animationTime * 2.6)) * 0.25 : 0);
      }
    }

    for (const node of resources) {
      const visual = this.resources.get(node.id);
      if (!visual) continue;
      visual.group.visible = node.alive && !this.hiddenEntities.has(node.id);
      visual.ring.visible = node.selected;
      // A depleted deposit visibly shrinks toward its bed.
      const remaining = Math.max(0.28, node.remaining / node.capacity);
      visual.resource?.shards.forEach((shard, index) => {
        shard.scale.setScalar(0.55 + remaining * 0.45);
        if (node.resourceType === 'energy' || node.resourceType === 'data') {
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
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(type === 'matter' ? 0xffca68 : type === 'energy' ? 0x61f5df : 0xc39cff);
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

  showPlacementGhost(type: PlaceableBuildingType, x: number, z: number, valid: boolean, rotated = false): void {
    if (!this.placementGhost || this.placementGhostType !== type) {
      this.removePlacementGhost();
      const config = BUILDINGS[type];
      const group = new THREE.Group();
      // The ghost is the real model in translucent faction glass, so what you see is what you get.
      const model = buildBuildingModel(this.cache, type, 'player', 'placement-ghost');
      for (const entry of model.generationParts) entry.part.visible = (this.generations.get('player') ?? 1) >= entry.min;
      model.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.material = this.ghostMaterials[0];
        object.castShadow = false;
        object.receiveShadow = false;
        delete object.userData.entityId;
      });
      const footprint = new THREE.Mesh(new THREE.BoxGeometry(config.footprint[0], 0.06, config.footprint[1]), this.ghostMaterials[1]);
      footprint.position.y = 0.05;
      group.add(model.group, footprint);
      this.scene.add(group);
      this.placementGhost = group;
      this.placementGhostType = type;
    }
    this.placementGhost.position.set(x, 0, z);
    this.placementGhost.rotation.y = rotated ? Math.PI / 2 : 0;
    for (const material of this.ghostMaterials) {
      material.color.setHex(valid ? 0x63efbd : 0xff665c);
      material.opacity = valid ? 0.45 : 0.55;
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
    this.environment.dispose();
    this.ghostMaterials.forEach((material) => material.dispose());
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.cache.dispose();
    this.fogTexture.dispose();
    this.scene.clear();
    this.units.clear();
    this.buildings.clear();
    this.resources.clear();
    this.placementGhost = null;
    this.placementGhostType = null;
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
    // Ghost geometry belongs to the shared cache; only the two ghost materials are ours.
    this.placementGhost = null;
  }

}

/** Shortest-path rotation toward a target angle, so units never spin the long way round. */
function approachAngle(current: number, target: number, maxStep: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}
