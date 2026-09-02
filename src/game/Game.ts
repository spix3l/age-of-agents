import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import { UNITS } from '../data/units';
import { useUiStore, type SelectionSnapshot } from '../ui/store';
import { RTSCameraController } from './camera/RTSCameraController';
import { issueGatherCommand } from './commands/GatherCommand';
import { issueMoveCommand } from './commands/MoveCommand';
import { Capacity } from './economy/Capacity';
import { EconomyLedger } from './economy/EconomyLedger';
import type { ResourceNodeEntity } from './entities/resources/ResourceNode';
import { GameLoop } from './GameLoop';
import { GameState } from './GameState';
import { InputManager } from './input/InputManager';
import { NavigationGrid } from './navigation/NavigationGrid';
import { Renderer } from './rendering/Renderer';
import { createWorkerEntity } from './scenarios/economy';
import { GatheringSystem } from './systems/GatheringSystem';
import { MovementSystem } from './systems/MovementSystem';
import { ProductionSystem, type ProductionRejection } from './systems/ProductionSystem';
import { SelectionSystem, type ScreenPoint, type SelectableEntity } from './systems/SelectionSystem';
import type { EntityId } from './types/ids';
import type { BuildingEntity, UnitEntity } from './types/simulation';
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
  private readonly production = new ProductionSystem();
  private readonly selection: SelectionSystem;
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private uiSnapshotCooldown = 0;
  private workerSequence = 4;
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
    });
    useUiStore.getState().setProductionRequest(this.enqueueWorker);
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
    this.production.update(
      this.state.buildings.alive(), delta,
      (team) => team === 'neutral' ? undefined : this.state.economies.get(team),
      this.spawnWorker,
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
    const resourceHit = this.raycaster.intersectObjects(this.world.selectableMeshes, false)
      .map((hit) => this.state.resources.get(hit.object.userData.entityId as EntityId))
      .find((node): node is ResourceNodeEntity => Boolean(node?.alive));
    if (resourceHit) {
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
    for (const worker of selectedWorkers) { worker.gatherOrder = null; worker.activity = 'Moving'; }
    const result = issueMoveCommand(selectedWorkers, target, this.navigation);
    if (result.issued > 0) {
      this.world.showMoveMarker(target.x, target.z);
      useUiStore.getState().setLastOrder(`MOVE // ${result.issued} AGENTS`);
      this.publishUi();
    }
  };

  private readonly enqueueWorker = (): void => {
    const core = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.kind === 'core' && entity.team === 'player');
    const economy = this.state.economies.get('player');
    if (!core || !economy) return;
    const result = this.production.enqueueWorker(core, economy.ledger, economy.capacity);
    useUiStore.getState().setLastOrder(result.ok ? 'WORKER FABRICATION QUEUED' : this.rejectionMessage(result.reason));
    this.publishUi();
  };

  private readonly spawnWorker = (core: BuildingEntity): UnitEntity | null => {
    if (core.team === 'neutral') return null;
    const target = { x: core.position.x + (core.team === 'player' ? 3.5 : -3.5), z: core.position.z };
    const cell = this.navigation.findNearestWalkable(target, 8);
    if (!cell) return null;
    const position = this.navigation.cellToWorld(cell);
    const worker = createWorkerEntity(`${core.team}-worker-${this.workerSequence++}`, core.team, position);
    this.state.units.add(worker);
    this.world.addUnit(worker);
    return worker;
  };

  private setRay(point: ScreenPoint): void {
    const bounds = this.renderer.instance.domElement.getBoundingClientRect();
    this.pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera.camera);
  }

  private publishUi(): void {
    const economy = this.state.economies.get('player');
    if (!economy) return;
    const balances = economy.ledger.snapshot();
    const capacity = economy.capacity.snapshot();
    const selected = this.selection?.selected() ?? [];
    const core = selected.find((entity): entity is BuildingEntity => isBuilding(entity) && entity.kind === 'core');
    const currentOrder = core?.productionQueue[0];
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
        count: core?.productionQueue.length ?? 0,
        progress: currentOrder ? Math.min(1, currentOrder.elapsed / currentOrder.duration) : 0,
        label: core?.productionQueue.length ? `${core.productionQueue.length} IN QUEUE` : 'QUEUE EMPTY',
      },
    });
  }

  private selectionSnapshot(selected: readonly SelectableEntity[]): SelectionSnapshot {
    if (selected.length === 0) return { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false };
    if (selected.length > 1) {
      const workers = selected.filter(isUnit);
      const active = workers.find((worker) => worker.activity !== 'Idle')?.activity ?? 'Idle';
      return { type: 'group', name: `${workers.length} WORKER AGENTS`, activity: active, detail: `${workers.reduce((sum, worker) => sum + worker.cargo.amount, 0)} cargo`, isPlayerCore: false };
    }
    const entity = selected[0]!;
    if (isUnit(entity)) return { type: 'unit', name: UNITS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.activity, detail: entity.cargo.amount > 0 ? `${entity.cargo.amount} ${entity.cargo.type}` : undefined, isPlayerCore: false };
    if (isBuilding(entity)) return { type: 'building', name: BUILDINGS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.productionQueue.length ? 'Fabricating' : 'Operational', detail: `${entity.productionQueue.length} queued`, isPlayerCore: entity.team === 'player' && entity.kind === 'core' };
    return { type: 'resource', name: RESOURCES[entity.resourceType].label, activity: `${entity.remaining} remaining`, detail: `${Math.round((entity.remaining / entity.capacity) * 100)}% integrity`, isPlayerCore: false };
  }

  private rejectionMessage(reason: ProductionRejection): string {
    if (reason === 'INSUFFICIENT_MATTER') return 'REJECTED // INSUFFICIENT MATTER';
    if (reason === 'CAPACITY_REACHED') return 'REJECTED // AGENT CAPACITY REACHED';
    return 'REJECTED // CORE OFFLINE';
  }
}
