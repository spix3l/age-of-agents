import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import { UNITS } from '../data/units';
import { useUiStore, type SelectionSnapshot } from '../ui/store';
import { RTSCameraController } from './camera/RTSCameraController';
import { PlacementController, validatePlacement, type PlaceableBuildingType, type PlacementFailure } from './building/PlacementController';
import { issueGatherCommand } from './commands/GatherCommand';
import { issueMoveCommand } from './commands/MoveCommand';
import { automateWorkers } from './commands/AutomateCommand';
import { Capacity } from './economy/Capacity';
import { EconomyLedger } from './economy/EconomyLedger';
import { activateCapacityProvider } from './economy/CapacityProviders';
import type { ResourceNodeEntity } from './entities/resources/ResourceNode';
import { createBuildingSite } from './entities/buildings/Building';
import { GameLoop } from './GameLoop';
import { GameState } from './GameState';
import { InputManager } from './input/InputManager';
import { NavigationGrid } from './navigation/NavigationGrid';
import { Renderer } from './rendering/Renderer';
import { createUnitEntity } from './scenarios/economy';
import { AutomationSystem } from './systems/AutomationSystem';
import { ConstructionSystem, constructionRefund } from './systems/ConstructionSystem';
import { GatheringSystem } from './systems/GatheringSystem';
import { MovementSystem } from './systems/MovementSystem';
import { ProductionSystem, type ProductionRejection } from './systems/ProductionSystem';
import { SelectionSystem, type ScreenPoint, type SelectableEntity } from './systems/SelectionSystem';
import { entityId, type EntityId, type UnitTypeId } from './types/ids';
import type { BuildingEntity, HarvestableResourceType, UnitEntity } from './types/simulation';
import { createMatch } from './world/createMatch';
import { MAP_BOUNDS, WORLD_OBSTACLES } from './world/map';
import { WorldScene } from './world/WorldScene';

function isUnit(entity: SelectableEntity): entity is UnitEntity { return 'movementSpeed' in entity; }
function isBuilding(entity: SelectableEntity): entity is BuildingEntity { return 'productionQueue' in entity; }

export class Game {
  private readonly renderer: Renderer;
  private readonly world: WorldScene;
  private readonly camera: RTSCameraController;
  private readonly state = new GameState();
  private readonly navigation: NavigationGrid;
  private readonly movement: MovementSystem;
  private readonly gathering: GatheringSystem;
  private readonly automation: AutomationSystem;
  private readonly construction: ConstructionSystem;
  private readonly production = new ProductionSystem();
  private readonly placement: PlacementController;
  private readonly selection: SelectionSystem;
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private uiSnapshotCooldown = 0;
  private unitSequence = 4;
  private buildingSequence = 1;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.world = new WorldScene();
    this.camera = new RTSCameraController(this.renderer.instance.domElement);
    this.navigation = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    WORLD_OBSTACLES.forEach((obstacle) => this.navigation.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));

    const match = createMatch();
    for (const team of ['player', 'enemy'] as const) {
      this.state.economies.set(team, {
        ledger: new EconomyLedger(match.startingBalances),
        capacity: new Capacity(match.startingBalances.capacity, 3),
      });
    }
    for (const building of match.buildings) {
      this.state.buildings.add(building);
      this.navigation.setBlockedRect(building.position, building.footprint, true, 0.35);
      this.world.addBuilding(building);
    }
    for (const resource of match.resources) {
      this.state.resources.add(resource);
      this.world.addResource(resource);
    }
    for (const unit of match.units) {
      this.state.units.add(unit);
      this.world.addUnit(unit);
    }

    this.movement = new MovementSystem(this.navigation);
    this.gathering = new GatheringSystem(
      this.state.resources,
      this.state.buildings,
      (team) => team === 'neutral' ? undefined : this.state.economies.get(team)?.ledger,
      this.navigation,
    );
    this.automation = new AutomationSystem(this.state.resources, this.navigation);
    this.construction = new ConstructionSystem(this.state.buildings, this.navigation, this.completeBuilding);
    this.placement = new PlacementController({
      validate: (type, position) => validatePlacement(type, position, this.navigation, this.state.buildings.alive(), this.state.resources.alive()),
      preview: (type, result) => this.world.showPlacementGhost(type, result.position.x, result.position.z, result.valid),
      hide: () => this.world.hidePlacementGhost(),
      confirmed: (type, result) => this.createConstruction(type, result.position),
      rejected: (failure) => useUiStore.getState().setLastOrder(`PLACEMENT REJECTED // ${this.placementFailure(failure)}`),
    });
    this.selection = new SelectionSystem(
      this.allSelectable,
      this.getSelectable,
      this.camera.camera,
      this.renderer.instance.domElement,
      this.world.selectableMeshes,
      () => this.publishUi(),
    );
    this.input = new InputManager(this.renderer.instance.domElement, {
      selectPoint: (point, additive) => this.selection.selectPoint(point, additive),
      selectBox: (rect, additive) => this.selection.selectBox(rect, additive),
      move: this.issueContextOrder,
      selectionBox: (rect) => useUiStore.getState().setSelectionBox(rect),
      hover: this.updatePlacement,
      primaryAction: this.confirmPlacement,
      cancelAction: this.cancelPlacement,
    });
    useUiStore.getState().setProductionRequest(this.enqueueWorker);
    useUiStore.getState().setBuildRequest(this.beginPlacement);
    useUiStore.getState().setAutomationRequest(this.automateSelection);
    useUiStore.getState().setUnitProductionRequest(this.enqueueUnit);
    useUiStore.getState().setCancelProductionRequest(this.cancelProduction);
    useUiStore.getState().setCancelConstructionRequest(this.cancelSelectedConstruction);
    this.loop = new GameLoop(this.update, this.render);
    this.publishUi();
  }

  start(): void { this.loop.start(); }
  setPaused(paused: boolean): void { this.loop.setPaused(paused); }
  restart(): void { this.state.elapsedSeconds = 0; this.loop.restart(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.dispose();
    this.input.dispose();
    this.camera.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.state.reset();
    useUiStore.getState().setSelectionBox(null);
    useUiStore.getState().setProductionRequest(null);
    useUiStore.getState().setBuildRequest(null);
    useUiStore.getState().setAutomationRequest(null);
    useUiStore.getState().setUnitProductionRequest(null);
    useUiStore.getState().setCancelProductionRequest(null);
    useUiStore.getState().setCancelConstructionRequest(null);
    useUiStore.getState().setPlacementMode(null);
  }

  private readonly allSelectable = (): readonly SelectableEntity[] => [
    ...this.state.units.all(), ...this.state.buildings.all(), ...this.state.resources.all(),
  ];

  private readonly getSelectable = (id: EntityId): SelectableEntity | undefined => (
    this.state.units.get(id) ?? this.state.buildings.get(id) ?? this.state.resources.get(id)
  );

  private readonly update = (delta: number): void => {
    this.state.elapsedSeconds += delta;
    this.camera.update(delta);
    this.movement.update(this.state.units.alive(), delta);
    this.gathering.update(this.state.units.alive(), delta);
    this.automation.update(this.state.units.alive(), delta);
    this.construction.update(this.state.units.alive(), delta);
    this.production.update(
      this.state.buildings.alive(), delta,
      (team) => team === 'neutral' ? undefined : this.state.economies.get(team),
      this.spawnUnit,
    );
    this.uiSnapshotCooldown -= delta;
    if (this.uiSnapshotCooldown <= 0) {
      this.publishUi();
      this.uiSnapshotCooldown = 0.1;
    }
  };

  private readonly render = (alpha: number): void => {
    this.world.syncUnits(this.state.units.all(), alpha);
    this.world.syncStructures(this.state.buildings.all(), this.state.resources.all());
    this.renderer.render(this.world.scene, this.camera.camera);
  };

  private readonly issueContextOrder = (point: ScreenPoint): void => {
    const selectedWorkers = this.selection.selected().filter(isUnit);
    if (selectedWorkers.length === 0) return;
    this.setRay(point);
    const hitIds = this.raycaster.intersectObjects(this.world.selectableMeshes, false).map((hit) => hit.object.userData.entityId as EntityId);
    const siteHit = hitIds.map((id) => this.state.buildings.get(id)).find((building) => Boolean(building?.alive && !building.operational && building.team === 'player'));
    if (siteHit) {
      const builder = selectedWorkers.find((unit) => unit.kind === 'worker');
      if (builder && this.construction.assign(builder, siteHit)) {
        useUiStore.getState().setLastOrder(`BUILD ${BUILDINGS[siteHit.kind].label.toUpperCase()} // WORKER ASSIGNED`);
        this.publishUi();
      }
      return;
    }
    const resourceHit = hitIds
      .map((id) => this.state.resources.get(id))
      .find((node): node is ResourceNodeEntity => Boolean(node?.alive));
    if (resourceHit) {
      for (const worker of selectedWorkers) { this.cancelWorkerBuild(worker); worker.automation = null; }
      const result = issueGatherCommand(selectedWorkers, resourceHit, this.navigation);
      if (result.issued > 0) {
        this.world.showGatherMarker(resourceHit.position.x, resourceHit.position.z, resourceHit.resourceType);
        useUiStore.getState().setLastOrder(`GATHER ${resourceHit.resourceType.toUpperCase()} // ${result.issued} AGENTS`);
        this.publishUi();
      } else {
        this.world.showRejectedMarker(resourceHit.position.x, resourceHit.position.z);
        useUiStore.getState().setLastOrder(`GATHER ${resourceHit.resourceType.toUpperCase()} REJECTED // NO PATH`);
      }
      return;
    }
    const hit = this.raycaster.intersectObject(this.world.ground, false)[0];
    if (!hit) return;
    const target = { x: hit.point.x, z: hit.point.z };
    for (const worker of selectedWorkers) { worker.gatherOrder = null; this.cancelWorkerBuild(worker); worker.automation = null; worker.activity = 'Moving'; }
    const result = issueMoveCommand(selectedWorkers, target, this.navigation);
    if (result.issued > 0) {
      this.world.showMoveMarker(target.x, target.z);
      useUiStore.getState().setLastOrder(`MOVE // ${result.issued} AGENTS`);
      this.publishUi();
    }
  };

  private readonly beginPlacement = (type: PlaceableBuildingType): void => {
    const workers = this.selection.selected().filter(isUnit).filter((unit) => unit.kind === 'worker');
    if (workers.length === 0) return;
    this.placement.begin(type);
    this.placement.update(workers[0]!.position);
    useUiStore.getState().setPlacementMode(type);
    useUiStore.getState().setLastOrder(`PLACE ${BUILDINGS[type].label.toUpperCase()} // CLICK TERRAIN`);
  };

  private readonly updatePlacement = (point: ScreenPoint): void => {
    if (!this.placement.active) return;
    const world = this.groundPoint(point);
    if (world) this.placement.update(world);
  };

  private readonly confirmPlacement = (point: ScreenPoint): boolean => {
    if (!this.placement.active) return false;
    const world = this.groundPoint(point);
    return world ? this.placement.confirm(world) : true;
  };

  private readonly cancelPlacement = (): boolean => {
    if (!this.placement.cancel()) return false;
    useUiStore.getState().setPlacementMode(null);
    useUiStore.getState().setLastOrder('PLACEMENT CANCELLED');
    return true;
  };

  private readonly enqueueWorker = (): void => {
    const core = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.kind === 'core' && entity.team === 'player');
    const economy = this.state.economies.get('player');
    if (!core || !economy) return;
    const result = this.production.enqueueWorker(core, economy.ledger, economy.capacity);
    useUiStore.getState().setLastOrder(result.ok ? 'WORKER FABRICATION QUEUED' : this.rejectionMessage(result.reason));
    this.publishUi();
  };

  private readonly enqueueUnit = (unitType: UnitTypeId): void => {
    const producer = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.team === 'player');
    const economy = this.state.economies.get('player');
    if (!producer || !economy) return;
    const result = this.production.enqueue(producer, unitType, economy.ledger, economy.capacity);
    useUiStore.getState().setLastOrder(result.ok ? `${UNITS[unitType].label.toUpperCase()} QUEUED` : this.rejectionMessage(result.reason));
    this.publishUi();
  };

  private readonly cancelProduction = (orderId: EntityId): void => {
    const producer = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.team === 'player');
    const economy = this.state.economies.get('player');
    if (!producer || !economy) return;
    if (this.production.cancelOrder(producer, orderId, economy.ledger, economy.capacity)) {
      useUiStore.getState().setLastOrder('PRODUCTION CANCELLED // FULL REFUND');
      this.publishUi();
    }
  };

  private readonly automateSelection = (resourceType: HarvestableResourceType): void => {
    const workers = this.selection.selected().filter(isUnit);
    for (const worker of workers) this.cancelWorkerBuild(worker);
    const changed = automateWorkers(workers, resourceType);
    if (changed > 0) {
      useUiStore.getState().setLastOrder(`AUTOMATE ${resourceType.toUpperCase()} // ${changed} WORKERS`);
      this.publishUi();
    }
  };

  private readonly spawnUnit = (producer: BuildingEntity, unitType: UnitTypeId): UnitEntity | null => {
    if (producer.team === 'neutral') return null;
    const target = { x: producer.position.x + (producer.team === 'player' ? 3.5 : -3.5), z: producer.position.z };
    const cell = this.navigation.findNearestWalkable(target, 8);
    if (!cell) return null;
    const position = this.navigation.cellToWorld(cell);
    const unit = createUnitEntity(`${producer.team}-${unitType}-${this.unitSequence++}`, unitType, producer.team, position);
    this.state.units.add(unit);
    this.world.addUnit(unit);
    return unit;
  };

  private createConstruction(type: PlaceableBuildingType, position: { x: number; z: number }): void {
    useUiStore.getState().setPlacementMode(null);
    const worker = this.selection.selected().filter(isUnit).find((unit) => unit.kind === 'worker');
    const economy = this.state.economies.get('player');
    const config = BUILDINGS[type];
    if (!worker || !economy) return;
    if (!economy.ledger.spend(config.cost)) {
      useUiStore.getState().setLastOrder('CONSTRUCTION REJECTED // INSUFFICIENT RESOURCES');
      this.publishUi();
      return;
    }
    const site = createBuildingSite(entityId(`player-${type}-${this.buildingSequence++}`), type, 'player', position, worker.id);
    this.state.buildings.add(site);
    this.navigation.setBlockedRect(site.position, site.footprint, true, 0.35);
    this.world.addBuilding(site);
    if (!this.construction.assign(worker, site)) {
      this.navigation.setBlockedRect(site.position, site.footprint, false, 0.35);
      this.state.buildings.destroy(site.id);
      this.world.removeBuilding(site.id);
      economy.ledger.refund(config.cost);
      useUiStore.getState().setLastOrder('CONSTRUCTION REJECTED // NO BUILD PATH');
      return;
    }
    useUiStore.getState().setLastOrder(`${config.label.toUpperCase()} CONSTRUCTION STARTED`);
    this.publishUi();
  }

  private readonly completeBuilding = (building: BuildingEntity): void => {
    const economy = building.team === 'neutral' ? undefined : this.state.economies.get(building.team);
    if (economy) activateCapacityProvider(building, economy.capacity);
    useUiStore.getState().setLastOrder(`${BUILDINGS[building.kind].label.toUpperCase()} ONLINE`);
    this.publishUi();
  };

  private readonly cancelSelectedConstruction = (): void => {
    const site = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && !entity.operational && entity.team === 'player');
    const economy = this.state.economies.get('player');
    if (!site || !economy) return;
    const refund = constructionRefund(site);
    economy.ledger.refund(refund);
    this.navigation.setBlockedRect(site.position, site.footprint, false, 0.35);
    this.state.buildings.destroy(site.id);
    this.world.removeBuilding(site.id);
    for (const worker of this.state.units.alive()) if (worker.buildOrder?.buildingId === site.id) { worker.buildOrder = null; worker.path = []; worker.pathIndex = 0; worker.destination = null; worker.activity = 'Idle'; }
    this.selection.clear();
    useUiStore.getState().setLastOrder('CONSTRUCTION CANCELLED // 75% REFUND');
    this.publishUi();
  };

  private setRay(point: ScreenPoint): void {
    const bounds = this.renderer.instance.domElement.getBoundingClientRect();
    this.pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera.camera);
  }

  private groundPoint(point: ScreenPoint): { x: number; z: number } | null {
    this.setRay(point);
    const hit = this.raycaster.intersectObject(this.world.ground, false)[0];
    return hit ? { x: hit.point.x, z: hit.point.z } : null;
  }

  private publishUi(): void {
    const economy = this.state.economies.get('player');
    if (!economy) return;
    const balances = economy.ledger.snapshot();
    const capacity = economy.capacity.snapshot();
    const selected = this.selection?.selected() ?? [];
    const producer = selected.find((entity): entity is BuildingEntity => isBuilding(entity) && (entity.kind === 'core' || entity.kind === 'fabricator'));
    const currentOrder = producer?.productionQueue[0];
    useUiStore.getState().setEconomySnapshot({
      matter: balances.matter,
      energy: balances.energy,
      capacityUsed: capacity.used,
      capacityReserved: capacity.reserved,
      capacityMax: capacity.max,
      totalUnits: this.state.units.alive().filter((unit) => unit.team === 'player').length,
      selectedCount: selected.length,
      selection: this.selectionSnapshot(selected),
      queue: {
        count: producer?.productionQueue.length ?? 0,
        progress: currentOrder ? Math.min(1, currentOrder.elapsed / currentOrder.duration) : 0,
        label: producer?.productionQueue.length ? `${producer.productionQueue.length} IN QUEUE` : 'QUEUE EMPTY',
        items: producer?.productionQueue.map((order) => ({ id: order.id, unitType: order.unitType, label: UNITS[order.unitType].label })) ?? [],
      },
    });
  }

  private selectionSnapshot(selected: readonly SelectableEntity[]): SelectionSnapshot {
    if (selected.length === 0) return { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false, canBuild: false };
    if (selected.length > 1) {
      const workers = selected.filter(isUnit);
      const active = workers.find((worker) => worker.activity !== 'Idle')?.activity ?? 'Idle';
      return { type: 'group', name: `${workers.length} WORKER AGENTS`, activity: active, detail: `${workers.reduce((sum, worker) => sum + worker.cargo.amount, 0)} cargo`, isPlayerCore: false, canBuild: workers.some((worker) => worker.kind === 'worker') };
    }
    const entity = selected[0]!;
    if (isUnit(entity)) return { type: 'unit', name: UNITS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.automation ? `Automating ${entity.automation.resourceType === 'matter' ? 'Matter' : 'Energy'}` : entity.activity, detail: entity.cargo.amount > 0 ? `${entity.cargo.amount} ${entity.cargo.type}` : undefined, isPlayerCore: false, canBuild: entity.kind === 'worker' };
    if (isBuilding(entity)) return { type: 'building', name: BUILDINGS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.operational ? (entity.productionQueue.length ? 'Fabricating' : 'Operational') : 'Under construction', detail: entity.operational ? `${entity.productionQueue.length} queued` : `${Math.round(entity.constructionProgress * 100)}% complete`, isPlayerCore: entity.team === 'player' && entity.kind === 'core', canBuild: false, producer: entity.team === 'player' && entity.operational ? (entity.kind === 'core' ? 'worker' : entity.kind === 'fabricator' ? 'striker' : null) : null, constructionSite: entity.team === 'player' && !entity.operational };
    return { type: 'resource', name: RESOURCES[entity.resourceType].label, activity: `${entity.remaining} remaining`, detail: `${Math.round((entity.remaining / entity.capacity) * 100)}% integrity`, isPlayerCore: false, canBuild: false };
  }

  private placementFailure(failure: PlacementFailure): string {
    if (failure === 'OUT_OF_BOUNDS') return 'OUTSIDE MAP';
    if (failure === 'RESOURCE_OVERLAP') return 'RESOURCE IN FOOTPRINT';
    if (failure === 'BUILDING_OVERLAP') return 'BUILDING IN FOOTPRINT';
    return 'TERRAIN BLOCKED';
  }

  private cancelWorkerBuild(worker: UnitEntity): void {
    if (!worker.buildOrder) return;
    const site = this.state.buildings.get(worker.buildOrder.buildingId);
    if (site?.builderId === worker.id) site.builderId = null;
    worker.buildOrder = null;
  }

  private rejectionMessage(reason: ProductionRejection): string {
    if (reason === 'INSUFFICIENT_RESOURCES') return 'REJECTED // INSUFFICIENT RESOURCES';
    if (reason === 'CAPACITY_REACHED') return 'REJECTED // AGENT CAPACITY REACHED';
    if (reason === 'NOT_OPERATIONAL') return 'REJECTED // PRODUCER NOT OPERATIONAL';
    return 'REJECTED // INVALID PRODUCER';
  }
}
