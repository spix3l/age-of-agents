import * as THREE from 'three';
import { DEFAULT_DIFFICULTY, type AIDifficulty } from '../data/ai';
import { BUILDINGS } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import { UNITS } from '../data/units';
import { BUILDING_GENERATION, GENERATIONS } from '../data/technologies';
import { useUiStore, type MinimapBlip, type SelectionSnapshot } from '../ui/store';
import { RTSCameraController } from './camera/RTSCameraController';
import { PlacementController, snappedPlacement, validatePlacement, type PlaceableBuildingType, type PlacementFailure } from './building/PlacementController';
import { footprintFor } from '../data/buildings';
import type { BuildRejection } from './commands/BuildCommand';
import { issueGatherCommand } from './commands/GatherCommand';
import { issueMoveCommand } from './commands/MoveCommand';
import { automateWorkers } from './commands/AutomateCommand';
import type { DeathRecord } from './combat/DamageService';
import { MatchSimulation } from './match/MatchSimulation';
import { captureSave, savedScenario, type GameMode, type SavedGame } from './save/SaveGame';
import { clearSave, writeSave } from './save/saveStorage';
import type { MatchResult } from './match/MatchState';
import type { ResourceNodeEntity } from './entities/resources/ResourceNode';
import { GameLoop } from './GameLoop';
import { InputManager } from './input/InputManager';
import { Renderer } from './rendering/Renderer';
import { constructionRefund } from './systems/ConstructionSystem';
import type { ProductionRejection } from './systems/ProductionSystem';
import { SelectionSystem, type ScreenPoint, type SelectableEntity } from './systems/SelectionSystem';
import type { EntityId, UnitTypeId } from './types/ids';
import type { BuildingEntity, CombatTarget, HarvestableResourceType, UnitEntity } from './types/simulation';
import { WorldScene } from './world/WorldScene';
import { MAP_BOUNDS } from './world/map';
import { VisionSystem } from './vision/VisionSystem';
import { AudioManager } from '../audio/AudioManager';

/** Village pieces are laid in runs: the placement tool stays armed and supports drag-laying. */
const REPEATABLE_BUILDINGS = new Set<PlaceableBuildingType>(['wall', 'gate', 'habitat']);

function isUnit(entity: SelectableEntity): entity is UnitEntity { return 'movementSpeed' in entity; }
function isBuilding(entity: SelectableEntity): entity is BuildingEntity { return 'productionQueue' in entity; }

export interface GameOptions {
  readonly difficulty?: AIDifficulty;
  /** Match seed. Drives the map layout and the opponent's opening; replayable when shared. */
  readonly seed?: number;
  /** Campaign runs the opponent; Freestyle leaves the map to the player. */
  readonly mode?: GameMode;
  /** A saved match to resume instead of opening a new one. */
  readonly save?: SavedGame | null;
}

export class Game {
  private readonly renderer: Renderer;
  private readonly world: WorldScene;
  private readonly camera: RTSCameraController;
  private readonly simulation: MatchSimulation;
  private readonly placement: PlacementController;
  private readonly selection: SelectionSystem;
  private readonly input: InputManager;
  private readonly vision: VisionSystem;
  private lastDragCell: { x: number; z: number } | null = null;
  /** The completed structure the armed placement tool is re-seating, if any. */
  private relocating: BuildingEntity | null = null;
  private readonly audio: AudioManager;
  private readonly loop: GameLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private uiSnapshotCooldown = 0;
  private lastFrameTime: number | null = null;
  private smoothedFps = 60;
  private disposed = false;
  private readonly mode: GameMode;
  private readonly difficulty: AIDifficulty;
  private readonly seed: number;
  private unsubscribePause: (() => void) | null = null;

  constructor(container: HTMLElement, options: GameOptions = {}) {
    this.renderer = new Renderer(container);
    this.world = new WorldScene();
    this.camera = new RTSCameraController(this.renderer.instance.domElement);
    this.audio = new AudioManager(this.renderer.instance.domElement);
    const save = options.save ?? null;
    this.mode = save?.mode ?? options.mode ?? 'campaign';
    this.difficulty = save?.difficulty ?? options.difficulty ?? DEFAULT_DIFFICULTY;
    this.seed = save?.seed ?? options.seed ?? 1;
    this.simulation = new MatchSimulation({
      difficulty: this.difficulty,
      // Drawn per match by the store, so the map layout and the opponent's opening both change
      // from game to game -- and can be replayed by anyone the result is shared with.
      seed: this.seed,
      // Freestyle is the same world with nobody in the far corner: no opposing colony is laid
      // down, and no opponent is given a turn.
      solo: this.mode === 'freestyle',
      opponent: this.mode !== 'freestyle',
      // A resumed match is built from the world the save describes rather than the generator's.
      fixture: save ? savedScenario(save) : undefined,
      hooks: {
        onUnitAdded: (unit) => {
          this.world.addUnit(unit);
          if (unit.kind === 'titan') {
            this.world.showHeavyArrival(unit.position, unit.team);
            this.audio.play('build');
          }
        },
        onUnitRemoved: (unit) => this.world.removeUnit(unit.id),
        onBuildingAdded: (building) => this.world.addBuilding(building),
        onBuildingRemoved: (building) => this.world.removeBuilding(building.id),
        onBuildingMoved: (building) => this.world.moveBuilding(building),
        onBuildingCompleted: this.announceBuilding,
        onShot: (attacker, target) => { this.world.showShot(attacker.position, target.position, attacker.team, 'footprint' in target ? 1.6 : 0.9, attacker.id); this.audio.play('shot'); },
        onDeath: this.announceDeath,
        onMatchEnd: this.endMatch,
        onGeneration: this.announceGeneration,
      },
    });
    // Economies, generations, the clock, and the production queues: everything a save records
    // that is not an entity. It runs before the first frame, so nothing is ever drawn or
    // published from the half-restored state.
    if (save) this.simulation.restoreState(save);
    this.vision = new VisionSystem(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    for (const resource of this.state.resources.all()) this.world.addResource(resource);
    this.updateVision(1);

    this.placement = new PlacementController({
      validate: (type, position, rotated) => this.relocating
        ? this.simulation.previewRelocation(this.relocating, position, rotated)
        : validatePlacement(type, position, this.navigation, this.state.buildings.alive(), this.state.resources.alive(), rotated),
      preview: (type, result) => this.world.showPlacementGhost(type, result.position.x, result.position.z, result.valid, result.rotated),
      hide: () => this.world.hidePlacementGhost(),
      confirmed: (type, result) => this.relocating
        ? this.finishRelocate(result.position, result.rotated)
        : this.createConstruction(type, result.position, result.rotated),
      rejected: (failure) => useUiStore.getState().setLastOrder(`${this.relocating ? 'RELOCATION' : 'PLACEMENT'} REJECTED // ${this.placementFailure(failure)}`),
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
      selectPoint: (point, additive) => { this.selection.selectPoint(point, additive); this.audio.play('select'); },
      selectBox: (rect, additive) => this.selection.selectBox(rect, additive),
      move: this.issueContextOrder,
      selectionBox: (rect) => useUiStore.getState().setSelectionBox(rect),
      hover: this.updatePlacement,
      primaryAction: this.confirmPlacement,
      primaryDrag: this.dragPlacement,
      rotateAction: this.rotatePlacement,
      cancelAction: this.cancelPlacement,
      toggleDebug: () => useUiStore.getState().toggleDebug(),
    });
    useUiStore.getState().setMinimapJumpRequest((x, z) => this.camera.jumpTo(x, z));
    useUiStore.getState().setProductionRequest(this.enqueueWorker);
    useUiStore.getState().setBuildRequest(this.beginPlacement);
    useUiStore.getState().setAutomationRequest(this.automateSelection);
    useUiStore.getState().setUnitProductionRequest(this.enqueueUnit);
    useUiStore.getState().setCancelProductionRequest(this.cancelProduction);
    useUiStore.getState().setCancelConstructionRequest(this.cancelSelectedConstruction);
    useUiStore.getState().setRelocateRequest(this.beginRelocate);
    useUiStore.getState().setAdvanceGenerationRequest(this.advanceGeneration);
    useUiStore.getState().setAudioToggleRequest(this.toggleAudio, this.audio.muted);
    useUiStore.getState().setAudioVolumeRequest(this.setAudioVolume, this.audio.volume);
    useUiStore.getState().setSaveRequest(this.saveGame);
    this.loop = new GameLoop(this.update, this.render);
    // Pause lives in the store, because the menu that offers it and the key that toggles it are
    // both UI. The loop is the only thing that acts on it: a paused match still renders and can
    // still be looked at, it just stops advancing.
    this.loop.setPaused(useUiStore.getState().paused);
    this.unsubscribePause = useUiStore.subscribe((state, previous) => {
      if (state.paused !== previous.paused) this.loop.setPaused(state.paused);
    });
    this.publishUi();
  }

  private get state() { return this.simulation.state; }
  private get navigation() { return this.simulation.navigation; }
  private get match() { return this.simulation.match; }

  start(): void { this.loop.start(); }
  setPaused(paused: boolean): void { this.loop.setPaused(paused); }
  restart(): void { this.loop.restart(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribePause?.();
    this.unsubscribePause = null;
    this.loop.dispose();
    this.input.dispose();
    this.camera.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.simulation.dispose();
    this.audio.dispose();
    useUiStore.getState().setSelectionBox(null);
    useUiStore.getState().setProductionRequest(null);
    useUiStore.getState().setBuildRequest(null);
    useUiStore.getState().setAutomationRequest(null);
    useUiStore.getState().setUnitProductionRequest(null);
    useUiStore.getState().setCancelProductionRequest(null);
    useUiStore.getState().setCancelConstructionRequest(null);
    useUiStore.getState().setAdvanceGenerationRequest(null);
    useUiStore.getState().setAudioToggleRequest(null);
    useUiStore.getState().setAudioVolumeRequest(null);
    useUiStore.getState().setSaveRequest(null);
    useUiStore.getState().setPlacementMode(null);
  }

  /**
   * Writes the running match to the single save slot. The player can ask for this at any time
   * from the pause menu; it never touches the simulation, so saving cannot change a match.
   */
  private readonly saveGame = (): boolean => {
    if (this.match.isOver) return false;
    return writeSave(captureSave(this.simulation, { mode: this.mode, difficulty: this.difficulty, seed: this.seed }));
  };

  /** Own entities are always selectable; anything else must be inside current vision. */
  private readonly isRevealed = (entity: SelectableEntity): boolean => (
    entity.team === 'player' || this.vision.stateAt(entity.position) === 2
  );

  private readonly allSelectable = (): readonly SelectableEntity[] => [
    ...this.state.units.all(), ...this.state.buildings.all(), ...this.state.resources.all(),
  ].filter(this.isRevealed);

  private readonly getSelectable = (id: EntityId): SelectableEntity | undefined => {
    const entity = this.state.units.get(id) ?? this.state.buildings.get(id) ?? this.state.resources.get(id);
    return entity && this.isRevealed(entity) ? entity : undefined;
  };

  private readonly update = (delta: number): void => {
    this.camera.update(delta);
    this.simulation.step(delta);
    this.updateVision(delta);
    this.publishThrottledUi(delta);
  };

  private updateVision(delta: number): void {
    const owned = [...this.state.units.alive(), ...this.state.buildings.alive()].filter((entity) => entity.team === 'player');
    if (!this.vision.update(owned, delta)) return;
    this.world.updateFog(this.vision.snapshot());
    for (const entity of [...this.state.units.all(), ...this.state.buildings.all(), ...this.state.resources.all()]) {
      this.world.setEntityVisible(entity.id, entity.team === 'player' || this.vision.stateAt(entity.position) === 2);
    }
  }

  private publishThrottledUi(delta: number): void {
    this.uiSnapshotCooldown -= delta;
    if (this.uiSnapshotCooldown > 0) return;
    this.publishUi();
    if (useUiStore.getState().debugVisible) this.publishDebug();
    this.uiSnapshotCooldown = 0.1;
  }

  private publishDebug(): void {
    const ai = this.simulation.opponent?.debug;
    const effects = this.world.effectCounters;
    useUiStore.getState().setDebugSnapshot({
      fps: Math.round(this.smoothedFps),
      units: this.state.units.alive().length,
      buildings: this.state.buildings.alive().length,
      elapsedSeconds: this.state.elapsedSeconds,
      aiState: ai?.state ?? 'OFFLINE',
      aiReason: ai?.reason ?? '—',
      aiWorkers: ai?.workers ?? 0,
      aiArmy: ai?.army ?? 0,
      aiAssault: ai?.assaultSize ?? 0,
      aiMatter: ai?.matter ?? 0,
      aiEnergy: ai?.energy ?? 0,
      aiCapacity: ai?.capacity ?? '0/0',
      aiCoreKnown: ai?.enemyCoreKnown ?? false,
      effectsActive: effects.active,
      effectsPooled: effects.pooled,
    });
  }

  /** Presentation and HUD reaction to a death; the simulation owns the cleanup itself. */
  private readonly announceDeath = (record: DeathRecord): void => {
    const entity = record.entity;
    const isBuilding = 'footprint' in entity;
    this.world.showDestruction(entity.position, entity.team, isBuilding ? Math.max(entity.footprint.x, entity.footprint.z) * 0.5 : 1);
    this.audio.play('destroy');
    this.selection.forget(entity.id);
    if (!isBuilding || entity.kind !== 'core') {
      useUiStore.getState().setLastOrder(`${entity.team === 'player' ? 'AGENT LOST' : 'HOSTILE DESTROYED'} // ${(isBuilding ? BUILDINGS[entity.kind].label : UNITS[entity.kind].label).toUpperCase()}`);
    }
    this.publishUi();
  };

  private readonly endMatch = (result: MatchResult): void => {
    const ledger = this.simulation.economy('player')?.ledger.collectedSnapshot();
    const stats = this.simulation.stats.snapshot('player');
    this.selection.clear();
    this.placement.cancel();
    this.world.hidePlacementGhost();
    useUiStore.getState().setPlacementMode(null);
    useUiStore.getState().setLastOrder(result === 'victory' ? 'ENEMY CORE DESTROYED' : 'CORE LOST');
    useUiStore.getState().setMatchOutcome(result, {
      durationSeconds: this.match.endedAt,
      matterCollected: ledger?.matter ?? 0,
      energyCollected: ledger?.energy ?? 0,
      dataCollected: ledger?.data ?? 0,
      agentsCreated: this.simulation.agentsCreated('player'),
      agentsKilled: stats.unitsKilled,
      agentsLost: stats.unitsLost,
      buildingsDestroyed: stats.buildingsDestroyed,
      buildingsLost: stats.buildingsLost,
      buildingsConstructed: this.simulation.buildingsConstructed('player'),
      finalGeneration: this.simulation.generation('player'),
    });
    this.audio.play(result === 'victory' ? 'victory' : 'defeat');
    // The slot described a match that no longer exists; leaving it offered would resume a game
    // whose ending the player has already seen.
    clearSave();
  };

  private readonly render = (alpha: number): void => {
    const now = performance.now();
    const frameDelta = this.lastFrameTime === null ? 1 / 60 : Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.smoothedFps += (1 / Math.max(frameDelta, 1 / 240) - this.smoothedFps) * 0.08;
    this.world.updatePresentation(frameDelta, this.camera.camera, this.camera.focusPoint, this.camera.zoomLevel);
    this.world.syncUnits(this.state.units.all(), alpha);
    this.world.syncStructures(this.state.buildings.all(), this.state.resources.all());
    this.renderer.render(this.world.scene, this.camera.camera);
  };

  private readonly issueContextOrder = (point: ScreenPoint): void => {
    if (this.match.isOver) return;
    const selectedWorkers = this.selection.selected().filter(isUnit);
    if (selectedWorkers.length === 0) return;
    this.setRay(point);
    const hitIds = this.raycaster.intersectObjects(this.world.selectableMeshes, false).map((hit) => hit.object.userData.entityId as EntityId);
    const hostileHit = hitIds
      .map((id): CombatTarget | undefined => this.state.units.get(id) ?? this.state.buildings.get(id))
      .find((entity): entity is CombatTarget => Boolean(
        entity?.alive && entity.team === 'enemy' && this.vision.stateAt(entity.position) === 2,
      ));
    if (hostileHit) {
      for (const attacker of selectedWorkers) this.cancelWorkerBuild(attacker);
      const issued = this.simulation.attack(selectedWorkers, hostileHit);
      if (issued > 0) {
        this.world.showAttackMarker(hostileHit.position.x, hostileHit.position.z);
        this.audio.play('command');
        useUiStore.getState().setLastOrder(`ATTACK // ${issued} AGENTS`);
      } else {
        this.world.showRejectedMarker(hostileHit.position.x, hostileHit.position.z);
        useUiStore.getState().setLastOrder('ATTACK REJECTED // NO APPROACH');
      }
      this.publishUi();
      return;
    }
    const siteHit = hitIds.map((id) => this.state.buildings.get(id)).find((building) => Boolean(building?.alive && !building.operational && building.team === 'player'));
    if (siteHit) {
      const builder = selectedWorkers.find((unit) => unit.kind === 'worker');
      if (builder && this.simulation.construction.assign(builder, siteHit)) {
        this.audio.play('command');
        useUiStore.getState().setLastOrder(`BUILD ${BUILDINGS[siteHit.kind].label.toUpperCase()} // WORKER ASSIGNED`);
        this.publishUi();
      }
      return;
    }
    const resourceHit = hitIds
      .map((id) => this.state.resources.get(id))
      .find((node): node is ResourceNodeEntity => Boolean(node?.alive && this.vision.stateAt(node.position) === 2));
    if (resourceHit) {
      for (const worker of selectedWorkers) { this.cancelWorkerBuild(worker); worker.automation = null; }
      const result = issueGatherCommand(selectedWorkers, resourceHit, this.navigation);
      if (result.issued > 0) {
        this.world.showGatherMarker(resourceHit.position.x, resourceHit.position.z, resourceHit.resourceType);
        this.audio.play('command');
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
    for (const worker of selectedWorkers) { worker.gatherOrder = null; this.cancelWorkerBuild(worker); worker.automation = null; }
    const result = issueMoveCommand(selectedWorkers, target, this.navigation);
    // Activity follows the routes the grid actually produced. Marking every selected Agent
    // "Moving" up front left an Agent that could not be routed -- walled in, or ordered onto an
    // unreachable pocket -- reading as en route for the rest of the match.
    for (const worker of selectedWorkers) {
      if (worker.destination === null) worker.activity = 'Idle';
      else worker.activity = 'Moving';
    }
    if (result.issued > 0) {
      this.world.showMoveMarker(target.x, target.z);
      this.audio.play('command');
      useUiStore.getState().setLastOrder(
        result.unreachable > 0
          ? `MOVE // ${result.issued} AGENTS // ${result.unreachable} NO ROUTE`
          : `MOVE // ${result.issued} AGENTS`,
      );
      this.publishUi();
    } else if (result.unreachable > 0) {
      useUiStore.getState().setLastOrder('NO ROUTE // TARGET UNREACHABLE');
      this.publishUi();
    }
  };

  private readonly beginPlacement = (type: PlaceableBuildingType): void => {
    if (this.match.isOver) return;
    const workers = this.selection.selected().filter(isUnit).filter((unit) => unit.kind === 'worker');
    if (workers.length === 0) return;
    if (!this.simulation.technology.canBuild('player', type)) {
      useUiStore.getState().setLastOrder(`LOCKED // REQUIRES GENERATION ${BUILDING_GENERATION[type]}`);
      return;
    }
    this.relocating = null;
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
    if (!world) return true;
    // Releasing at the end of a drag must not try to place a second piece on the last cell.
    const laid = this.lastDragCell;
    this.lastDragCell = null;
    const snapped = this.placementSnap(world);
    if (laid && laid.x === snapped.x && laid.z === snapped.z) return true;
    return this.placement.confirm(world);
  };

  /**
   * Dragging with a village piece selected lays a continuous run. Each snapped cell is placed
   * at most once, so one sweep across the map cannot spend a colony's Matter twice over.
   */
  private readonly dragPlacement = (point: ScreenPoint): boolean => {
    const type = this.placement.type;
    // Relocation moves one existing structure; a drag must never lay a run of copies of it.
    if (!type || this.relocating || !REPEATABLE_BUILDINGS.has(type)) return false;
    const world = this.groundPoint(point);
    if (!world) return true;
    const snapped = this.placementSnap(world);
    if (this.lastDragCell && this.lastDragCell.x === snapped.x && this.lastDragCell.z === snapped.z) return true;
    this.lastDragCell = snapped;
    this.placement.confirm(world);
    return true;
  };

  private readonly rotatePlacement = (): boolean => this.placement.rotate();

  /** The drag de-dup key must match the real placement snap, which is footprint-aware. */
  private placementSnap(world: { x: number; z: number }): { x: number; z: number } {
    const type = this.placement.type;
    return snappedPlacement(world, type ? footprintFor(type, this.placement.rotated) : undefined);
  }

  private readonly cancelPlacement = (): boolean => {
    this.lastDragCell = null;
    const wasRelocating = this.relocating !== null;
    this.relocating = null;
    if (!this.placement.cancel()) return false;
    useUiStore.getState().setPlacementMode(null);
    useUiStore.getState().setLastOrder(wasRelocating ? 'RELOCATION CANCELLED' : 'PLACEMENT CANCELLED');
    return true;
  };

  /**
   * Arms the placement tool over a structure the colony already owns. Nothing is spent and
   * nothing is torn down: confirming re-seats the same entity, so its HP, production queue, and
   * capacity contribution all survive the move.
   */
  private readonly beginRelocate = (): void => {
    if (this.match.isOver) return;
    const building = this.selection.selected().find(
      (entity): entity is BuildingEntity => isBuilding(entity) && entity.team === 'player' && this.simulation.canRelocate(entity),
    );
    if (!building) return;
    this.relocating = building;
    const type = building.kind as PlaceableBuildingType;
    this.placement.begin(type, building.rotated);
    this.placement.update(building.position);
    useUiStore.getState().setPlacementMode(type, true);
    useUiStore.getState().setLastOrder(`RELOCATE ${BUILDINGS[building.kind].label.toUpperCase()} // CLICK NEW SITE`);
  };

  private finishRelocate(position: { x: number; z: number }, rotated: boolean): void {
    const building = this.relocating;
    this.relocating = null;
    useUiStore.getState().setPlacementMode(null);
    if (!building) return;
    const result = this.simulation.relocate(building, position, rotated);
    if (result.ok) {
      this.audio.play('build');
      useUiStore.getState().setLastOrder(`${BUILDINGS[building.kind].label.toUpperCase()} RELOCATED`);
    } else {
      useUiStore.getState().setLastOrder(`RELOCATION REJECTED // ${result.reason === 'INVALID_PLACEMENT' && result.placement?.failure ? this.placementFailure(result.placement.failure) : 'STRUCTURE CANNOT MOVE'}`);
    }
    this.publishUi();
  }

  private readonly enqueueWorker = (): void => {
    if (this.match.isOver) return;
    const core = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.kind === 'core' && entity.team === 'player');
    if (!core) return;
    const result = this.simulation.enqueue(core, 'worker');
    useUiStore.getState().setLastOrder(result.ok ? 'WORKER FABRICATION QUEUED' : this.rejectionMessage(result.reason));
    this.publishUi();
  };

  private readonly enqueueUnit = (unitType: UnitTypeId): void => {
    if (this.match.isOver) return;
    const producer = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.team === 'player');
    if (!producer) return;
    const result = this.simulation.enqueue(producer, unitType);
    useUiStore.getState().setLastOrder(result.ok ? `${UNITS[unitType].label.toUpperCase()} QUEUED` : this.rejectionMessage(result.reason));
    this.publishUi();
  };

  private readonly cancelProduction = (orderId: EntityId): void => {
    if (this.match.isOver) return;
    const producer = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && entity.team === 'player');
    const economy = this.simulation.economy('player');
    if (!producer || !economy) return;
    if (this.simulation.production.cancelOrder(producer, orderId, economy.ledger, economy.capacity)) {
      useUiStore.getState().setLastOrder('PRODUCTION CANCELLED // FULL REFUND');
      this.publishUi();
    }
  };

  private readonly automateSelection = (resourceType: HarvestableResourceType): void => {
    if (this.match.isOver) return;
    const workers = this.selection.selected().filter(isUnit);
    for (const worker of workers) this.cancelWorkerBuild(worker);
    const changed = automateWorkers(workers, resourceType);
    if (changed > 0) {
      this.audio.play('command');
      useUiStore.getState().setLastOrder(`AUTOMATE ${resourceType.toUpperCase()} // ${changed} WORKERS`);
      this.publishUi();
    }
  };

  private createConstruction(type: PlaceableBuildingType, position: { x: number; z: number }, rotated: boolean): void {
    const worker = this.selection.selected().filter(isUnit).find((unit) => unit.kind === 'worker');
    if (!worker) { useUiStore.getState().setPlacementMode(null); return; }
    const result = this.simulation.build(worker, type, position, rotated);
    useUiStore.getState().setLastOrder(result.ok
      ? `${BUILDINGS[type].label.toUpperCase()} CONSTRUCTION STARTED`
      : `CONSTRUCTION REJECTED // ${this.buildFailure(result.reason)}`);
    // Walls, gates, and habitats are placed in runs, so the tool stays armed until it is
    // cancelled or the colony runs out of Matter.
    if (result.ok && REPEATABLE_BUILDINGS.has(type)) {
      this.placement.begin(type);
      this.placement.update(position);
    } else {
      useUiStore.getState().setPlacementMode(null);
    }
    this.publishUi();
    if (result.ok) this.audio.play('build');
  }

  private readonly announceBuilding = (building: BuildingEntity): void => {
    if (building.team !== 'player') return;
    useUiStore.getState().setLastOrder(`${BUILDINGS[building.kind].label.toUpperCase()} ONLINE`);
    this.audio.play('build');
    this.publishUi();
  };

  private readonly announceGeneration = (team: 'player' | 'enemy', generation: 1 | 2 | 3): void => {
    this.world.setGeneration(team, generation);
    if (team !== 'player') return;
    useUiStore.getState().setLastOrder(`GENERATION ${generation} // ${GENERATIONS[generation].label.toUpperCase()}`);
    this.audio.play('evolve');
    this.publishUi();
  };

  private readonly toggleAudio = (): void => {
    this.audio.setMuted(!this.audio.muted);
    useUiStore.getState().setAudioToggleRequest(this.toggleAudio, this.audio.muted);
  };

  private readonly setAudioVolume = (volume: number): void => {
    this.audio.setVolume(volume);
    useUiStore.getState().setAudioVolumeRequest(this.setAudioVolume, this.audio.volume);
  };

  private readonly advanceGeneration = (): void => {
    if (this.match.isOver) return;
    const result = this.simulation.advanceGeneration('player');
    if (!result.ok) {
      useUiStore.getState().setLastOrder(result.reason === 'MAX_GENERATION' ? 'SINGULARITY ALREADY ACHIEVED' : 'EVOLUTION REJECTED // INSUFFICIENT RESOURCES');
      this.publishUi();
    }
  };

  private buildFailure(reason: BuildRejection): string {
    if (reason === 'INSUFFICIENT_RESOURCES') return 'INSUFFICIENT RESOURCES';
    if (reason === 'NO_BUILD_PATH') return 'NO BUILD PATH';
    if (reason === 'INVALID_PLACEMENT') return 'INVALID SITE';
    if (reason === 'LOCKED') return 'GENERATION LOCKED';
    return 'NO WORKER SELECTED';
  }

  private readonly cancelSelectedConstruction = (): void => {
    if (this.match.isOver) return;
    const site = this.selection.selected().find((entity): entity is BuildingEntity => isBuilding(entity) && !entity.operational && entity.team === 'player');
    if (!site || !this.simulation.removeConstructionSite(site, constructionRefund(site))) return;
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

  /**
   * Collected totals sampled a few seconds apart, so the HUD can show income per second. Rates
   * are read from the ledger's cumulative totals rather than tracked per deposit, which keeps
   * the gathering system unaware that a HUD exists.
   */
  private incomeSample: { at: number; matter: number; energy: number; data: number } | null = null;
  private income = { matter: 0, energy: 0, data: 0 };

  private sampleIncome(): void {
    const ledger = this.simulation.economy('player')?.ledger;
    if (!ledger) return;
    const now = this.simulation.elapsedSeconds;
    const totals = ledger.collectedSnapshot();
    const previous = this.incomeSample;
    if (!previous) {
      this.incomeSample = { at: now, matter: totals.matter, energy: totals.energy, data: totals.data };
      return;
    }
    const span = now - previous.at;
    if (span < 4) return;
    this.income = {
      matter: (totals.matter - previous.matter) / span,
      energy: (totals.energy - previous.energy) / span,
      data: (totals.data - previous.data) / span,
    };
    this.incomeSample = { at: now, matter: totals.matter, energy: totals.energy, data: totals.data };
  }

  private publishUi(): void {
    const economy = this.simulation.economy('player');
    if (!economy) return;
    this.sampleIncome();
    this.publishMinimap();
    const balances = economy.ledger.snapshot();
    const capacity = economy.capacity.snapshot();
    const selected = this.selection?.selected() ?? [];
    const producer = selected.find((entity): entity is BuildingEntity => isBuilding(entity) && (entity.kind === 'core' || entity.kind === 'fabricator' || entity.kind === 'foundry'));
    const currentOrder = producer?.productionQueue[0];
    useUiStore.getState().setEconomySnapshot({
      matter: balances.matter,
      energy: balances.energy,
      data: balances.data,
      generation: this.simulation.generation('player'),
      capacityUsed: capacity.used,
      capacityReserved: capacity.reserved,
      capacityMax: capacity.max,
      totalUnits: this.state.units.alive().filter((unit) => unit.team === 'player').length,
      income: this.income,
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

  /**
   * Feeds the minimap. Hostiles are filtered through the same vision predicate the world and
   * selection use, so the minimap can never reveal something the battlefield is hiding.
   */
  private publishMinimap(): void {
    const blips: MinimapBlip[] = [];
    for (const unit of this.state.units.alive()) {
      if (unit.team === 'player') blips.push({ x: unit.position.x, z: unit.position.z, kind: 'own', building: false });
      else if (this.isRevealed(unit)) blips.push({ x: unit.position.x, z: unit.position.z, kind: 'hostile', building: false });
    }
    for (const building of this.state.buildings.alive()) {
      if (building.team === 'player') blips.push({ x: building.position.x, z: building.position.z, kind: 'own', building: true });
      else if (building.team !== 'neutral' && this.isRevealed(building)) {
        blips.push({ x: building.position.x, z: building.position.z, kind: 'hostile', building: true });
      }
    }
    for (const node of this.state.resources.alive()) {
      if (this.vision.stateAt(node.position) === 0) continue;
      blips.push({ x: node.position.x, z: node.position.z, kind: node.resourceType, building: false });
    }
    const fog = this.vision.snapshot();
    const focus = this.camera.focusPoint;
    useUiStore.getState().setMinimap({
      blips,
      fog: fog.states,
      fogWidth: fog.width,
      fogHeight: fog.height,
      focusX: focus.x,
      focusZ: focus.z,
      viewHalf: 42 / this.camera.zoomLevel,
    });
  }

  private selectionSnapshot(selected: readonly SelectableEntity[]): SelectionSnapshot {
    if (selected.length === 0) return { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false, canBuild: false };
    if (selected.length > 1) {
      const units = selected.filter(isUnit);
      const active = units.find((unit) => unit.activity !== 'Idle')?.activity ?? 'Idle';
      const strikers = units.filter((unit) => unit.kind === 'striker').length;
      const cargo = units.reduce((sum, unit) => sum + unit.cargo.amount, 0);
      return {
        type: 'group',
        name: strikers === units.length ? `${strikers} STRIKERS` : strikers > 0 ? `${units.length} AGENTS` : `${units.length} WORKER AGENTS`,
        activity: active,
        detail: strikers > 0 ? `${strikers} armed` : `${cargo} cargo`,
        isPlayerCore: false,
        canBuild: units.some((unit) => unit.kind === 'worker'),
      };
    }
    const entity = selected[0]!;
    if (isUnit(entity)) return { type: 'unit', name: UNITS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.automation ? `Automating ${entity.automation.resourceType === 'matter' ? 'Matter' : entity.automation.resourceType === 'energy' ? 'Energy' : 'Data'}` : entity.activity, detail: entity.cargo.amount > 0 ? `${entity.cargo.amount} ${entity.cargo.type}` : undefined, isPlayerCore: false, canBuild: entity.kind === 'worker' };
    if (isBuilding(entity)) {
      const generation = this.simulation.generation('player');
      const catalog: readonly UnitTypeId[] | null = entity.kind === 'core' ? ['worker']
        : entity.kind === 'fabricator' ? (generation >= 2 ? ['striker', 'ranger', 'scout'] : ['striker'])
          : entity.kind === 'foundry' ? ['titan'] : null;
      return { type: 'building', name: BUILDINGS[entity.kind].label, hp: entity.hp, maxHp: entity.maxHp, activity: entity.operational ? (entity.productionQueue.length ? 'Fabricating' : entity.combat ? 'Defending' : 'Operational') : 'Under construction', detail: entity.operational ? `${entity.productionQueue.length} queued` : `${Math.round(entity.constructionProgress * 100)}% complete`, isPlayerCore: entity.team === 'player' && entity.kind === 'core', canBuild: false, producer: entity.team === 'player' && entity.operational ? catalog : null, constructionSite: entity.team === 'player' && !entity.operational, canRelocate: entity.team === 'player' && this.simulation.canRelocate(entity) };
    }
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
    if (reason === 'LOCKED') return 'REJECTED // GENERATION LOCKED';
    return 'REJECTED // INVALID PRODUCER';
  }
}
