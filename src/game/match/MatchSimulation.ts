import { setBuildingOccupancy } from '../navigation/occupancy';
import { issueBuildCommand, type BuildCommandResult } from '../commands/BuildCommand';
import { canRelocate, issueRelocateCommand, validateRelocation, type RelocateResult } from '../commands/RelocateCommand';
import { issueAttackCommand } from '../commands/AttackCommand';
import { DamageService, type DeathRecord } from '../combat/DamageService';
import { destroyEntity } from '../combat/destruction';
import { MatchStats } from '../combat/MatchStats';
import { Capacity } from '../economy/Capacity';
import { activateCapacityProvider } from '../economy/CapacityProviders';
import { EconomyLedger } from '../economy/EconomyLedger';
import { GameState, type FactionEconomy } from '../GameState';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createUnitEntity, type EconomyScenario } from '../scenarios/economy';
import { SpatialHash } from '../spatial/SpatialHash';
import { AutomationSystem } from '../systems/AutomationSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ConstructionSystem } from '../systems/ConstructionSystem';
import { GatheringSystem } from '../systems/GatheringSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { ProductionSystem, type EnqueueResult } from '../systems/ProductionSystem';
import { TechnologySystem, type AdvanceResult } from '../systems/TechnologySystem';
import { TurretSystem } from '../systems/TurretSystem';
import { entityId, type UnitTypeId } from '../types/ids';
import { UNITS } from '../../data/units';
import type { BuildingEntity, CombatTarget, Generation, Team, UnitEntity, Vec2 } from '../types/simulation';
import type { PlaceableBuildingType } from '../building/PlacementController';
import { createMatch, type MatchOptions } from '../world/createMatch';
import { MAP_BOUNDS, WORLD_OBSTACLES } from '../world/map';
import { AIController, type AIControllerOptions } from '../ai/AIController';
import type { AIDifficulty } from '../../data/ai';
import { MatchState, type MatchResult } from './MatchState';
import type { SavedGame } from '../save/SaveGame';

export interface MatchHooks {
  readonly onUnitAdded?: (unit: UnitEntity) => void;
  readonly onUnitRemoved?: (unit: UnitEntity) => void;
  readonly onBuildingAdded?: (building: BuildingEntity) => void;
  readonly onBuildingRemoved?: (building: BuildingEntity) => void;
  /** A completed structure was picked up and set down elsewhere; its id is unchanged. */
  readonly onBuildingMoved?: (building: BuildingEntity) => void;
  readonly onBuildingCompleted?: (building: BuildingEntity) => void;
  readonly onShot?: (attacker: UnitEntity | BuildingEntity, target: CombatTarget) => void;
  readonly onDeath?: (record: DeathRecord) => void;
  readonly onMatchEnd?: (result: MatchResult) => void;
  readonly onGeneration?: (team: PlayableTeam, generation: Generation) => void;
}

export interface MatchSimulationOptions extends MatchOptions {
  /** Pre-built entities, used by fixtures. Overrides the `scenario` id when present. */
  readonly fixture?: EconomyScenario;
  readonly hooks?: MatchHooks;
  /** Set to false to run without an opponent, e.g. in isolated combat fixtures. */
  readonly opponent?: boolean | AIControllerOptions;
  readonly difficulty?: AIDifficulty;
}

type PlayableTeam = Exclude<Team, 'neutral'>;

/**
 * Authoritative simulation of one match: entities, economies, every fixed-step system,
 * destruction, and match end. It contains no Three.js, DOM, or React, so the rendered game
 * and headless AI/soak runs advance exactly the same code.
 */
export class MatchSimulation {
  readonly state = new GameState();
  readonly navigation = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
  readonly stats = new MatchStats();
  readonly damage = new DamageService(this.stats);
  readonly match = new MatchState();
  readonly targets = new SpatialHash<CombatTarget>();
  readonly movement: MovementSystem;
  readonly gathering: GatheringSystem;
  readonly automation: AutomationSystem;
  readonly construction: ConstructionSystem;
  readonly production = new ProductionSystem();
  readonly technology: TechnologySystem;
  readonly combat: CombatSystem;
  readonly turrets: TurretSystem;
  readonly opponent: AIController | null;
  private readonly hooks: MatchHooks;
  private readonly agentsBuilt: Record<PlayableTeam, number> = { player: 0, enemy: 0 };
  private readonly structuresBuilt: Record<PlayableTeam, number> = { player: 0, enemy: 0 };
  private unitSequence = 1;
  private buildingSequence = 1;

  constructor(options: MatchSimulationOptions = {}) {
    this.hooks = options.hooks ?? {};
    const scenario = options.fixture ?? createMatch(options);
    WORLD_OBSTACLES.forEach((obstacle) => this.navigation.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));
    for (const team of ['player', 'enemy'] as const) {
      this.state.economies.set(team, {
        ledger: new EconomyLedger(scenario.startingBalances),
        capacity: new Capacity(scenario.startingBalances.capacity, scenario.units.filter((unit) => unit.team === team).length),
      });
      this.state.generations.set(team, 1);
    }
    for (const building of scenario.buildings) {
      this.state.buildings.add(building);
      setBuildingOccupancy(this.navigation, building, true);
      this.hooks.onBuildingAdded?.(building);
    }
    for (const resource of scenario.resources) this.state.resources.add(resource);
    for (const unit of scenario.units) {
      this.state.units.add(unit);
      this.hooks.onUnitAdded?.(unit);
    }

    this.movement = new MovementSystem(this.navigation);
    this.gathering = new GatheringSystem(
      this.state.resources,
      this.state.buildings,
      (team) => this.economy(team)?.ledger,
      this.navigation,
    );
    this.automation = new AutomationSystem(this.state.resources, this.navigation);
    this.construction = new ConstructionSystem(this.state.buildings, this.navigation, this.completeBuilding);
    this.combat = new CombatSystem({
      targets: this.targets,
      lookup: (id) => this.state.units.get(id) ?? this.state.buildings.get(id),
      damage: this.damage,
      grid: this.navigation,
      onShot: this.hooks.onShot,
    });
    this.technology = new TechnologySystem(this.state.generations);
    this.turrets = new TurretSystem({
      targets: this.targets,
      lookup: (id) => this.state.units.get(id) ?? this.state.buildings.get(id),
      damage: this.damage,
      onShot: this.hooks.onShot,
    });
    const opponent = options.opponent ?? true;
    this.opponent = opponent === false
      ? null
      : new AIController(this, {
        seed: options.seed,
        difficulty: options.difficulty,
        ...(opponent === true ? {} : opponent),
      });
  }

  get elapsedSeconds(): number { return this.state.elapsedSeconds; }

  /** Id counters, exposed so a save can put them back and never re-mint an id already in use. */
  get idSequences(): { readonly unit: number; readonly building: number } {
    return { unit: this.unitSequence, building: this.buildingSequence };
  }

  /**
   * Applies the match-wide half of a save onto a simulation already built from `savedScenario`:
   * the clock, both economies, both generations, the kill tally, and the production queues.
   *
   * Queues are re-created here rather than in the scenario because their capacity has to be
   * reserved against the restored `Capacity`, and an order that no longer fits is refunded
   * instead of silently overdrawing the colony's Agent cap.
   */
  restoreState(save: SavedGame): void {
    this.state.elapsedSeconds = save.elapsedSeconds;
    this.unitSequence = Math.max(this.unitSequence, save.sequences.unit);
    this.buildingSequence = Math.max(this.buildingSequence, save.sequences.building);
    for (const team of ['player', 'enemy'] as const) {
      const saved = save.teams[team];
      const ledger = new EconomyLedger(saved.balances, saved.collected);
      const capacity = new Capacity(saved.capacityMax, saved.capacityUsed);
      this.state.economies.set(team, { ledger, capacity });
      this.state.generations.set(team, saved.generation);
      this.stats.restore(team, saved.stats);
      this.agentsBuilt[team] = saved.agentsCreated;
      this.structuresBuilt[team] = saved.buildingsConstructed;
      if (saved.generation > 1) this.hooks.onGeneration?.(team, saved.generation);
    }
    for (const building of save.buildings) {
      const producer = this.state.buildings.get(entityId(building.id));
      const economy = this.economy(building.team);
      if (!producer || !economy) continue;
      for (const order of building.queue) {
        if (economy.capacity.reserve(UNITS[order.unitType].capacityCost)) this.production.restoreOrder(producer, order.unitType, order.elapsed);
        else economy.ledger.refund(UNITS[order.unitType].cost);
      }
    }
  }

  economy(team: Team): FactionEconomy | undefined {
    return team === 'neutral' ? undefined : this.state.economies.get(team);
  }

  agentsCreated(team: PlayableTeam): number { return this.agentsBuilt[team]; }
  buildingsConstructed(team: PlayableTeam): number { return this.structuresBuilt[team]; }

  step(delta = 1 / 30): void {
    if (this.match.isOver) return;
    this.state.elapsedSeconds += delta;
    const units = this.state.units.alive();
    this.movement.update(units, delta);
    this.gathering.update(units, delta);
    this.automation.update(units, delta);
    this.construction.update(units, delta);
    this.production.update(this.state.buildings.alive(), delta, (team) => this.economy(team), this.spawnUnit);
    this.targets.sync([...this.state.units.alive(), ...this.state.buildings.alive()]);
    this.combat.update(this.state.units.alive(), delta);
    this.turrets.update(this.state.buildings.alive(), delta);
    this.damage.processDeaths(this.handleDeath);
    this.opponent?.update(delta);
  }

  /** Advances the match until it ends or the budget runs out. Returns the steps taken. */
  run(seconds: number, delta = 1 / 30): number {
    const steps = Math.round(seconds / delta);
    let taken = 0;
    for (; taken < steps && !this.match.isOver; taken += 1) this.step(delta);
    return taken;
  }

  enqueue(producer: BuildingEntity, unitType: UnitTypeId): EnqueueResult {
    const economy = this.economy(producer.team);
    if (!economy) return { ok: false, reason: 'NOT_A_PRODUCER' };
    if (producer.team === 'neutral' || !this.technology.canProduce(producer.team, unitType)) return { ok: false, reason: 'LOCKED' };
    return this.production.enqueue(producer, unitType, economy.ledger, economy.capacity);
  }

  generation(team: PlayableTeam): Generation { return this.technology.current(team); }

  advanceGeneration(team: PlayableTeam): AdvanceResult {
    const economy = this.economy(team);
    if (!economy) return { ok: false, reason: 'INSUFFICIENT_RESOURCES' };
    const result = this.technology.advance(team, economy.ledger);
    if (result.ok) this.hooks.onGeneration?.(team, result.generation);
    return result;
  }

  build(worker: UnitEntity, type: PlaceableBuildingType, position: Vec2, rotated = false): BuildCommandResult {
    if (worker.team === 'neutral') return { ok: false, reason: 'INVALID_WORKER' };
    return issueBuildCommand(worker, type, position, worker.team, {
      state: this.state,
      navigation: this.navigation,
      construction: this.construction,
      canBuild: (kind, team) => this.technology.canBuild(team, kind),
      nextBuildingId: (kind, team) => entityId(`${team}-${kind}-b${this.buildingSequence++}`),
      onCreated: (site) => this.hooks.onBuildingAdded?.(site),
      onRemoved: (site) => this.hooks.onBuildingRemoved?.(site),
    }, rotated);
  }

  /** Whether this structure is one a player may pick up at all, ignoring where they aim it. */
  canRelocate(building: BuildingEntity): boolean { return canRelocate(building); }

  /** Previews a relocation target without moving anything. */
  previewRelocation(building: BuildingEntity, position: Vec2, rotated = building.rotated) {
    return validateRelocation(building, position, { state: this.state, navigation: this.navigation }, rotated);
  }

  relocate(building: BuildingEntity, position: Vec2, rotated = building.rotated): RelocateResult {
    const result = issueRelocateCommand(building, position, { state: this.state, navigation: this.navigation }, rotated);
    if (result.ok) this.hooks.onBuildingMoved?.(building);
    return result;
  }

  attack(units: readonly UnitEntity[], target: CombatTarget): number {
    // The target index is handed over so an attacker with no route can fall back to whatever
    // structure is blocking it instead of refusing the order outright.
    return issueAttackCommand(units, target, this.navigation, this.targets).issued;
  }

  /** Cancels a construction site and refunds it, unblocking its footprint and its builder. */
  removeConstructionSite(site: BuildingEntity, refund: Readonly<Partial<Record<'matter' | 'energy' | 'data', number>>>): boolean {
    if (!this.state.buildings.has(site.id) || site.operational) return false;
    this.economy(site.team)?.ledger.refund(refund);
    setBuildingOccupancy(this.navigation, site, false);
    this.state.buildings.destroy(site.id);
    for (const worker of this.state.units.alive()) {
      if (worker.buildOrder?.buildingId !== site.id) continue;
      worker.buildOrder = null;
      worker.path = [];
      worker.pathIndex = 0;
      worker.destination = null;
      worker.activity = 'Idle';
    }
    this.hooks.onBuildingRemoved?.(site);
    return true;
  }

  unitsOf(team: PlayableTeam): readonly UnitEntity[] {
    return this.state.units.alive().filter((unit) => unit.team === team);
  }

  buildingsOf(team: PlayableTeam): readonly BuildingEntity[] {
    return this.state.buildings.alive().filter((building) => building.team === team);
  }

  coreOf(team: PlayableTeam): BuildingEntity | undefined {
    return this.state.buildings.alive().find((building) => building.team === team && building.kind === 'core');
  }

  dispose(): void {
    this.state.reset();
    this.targets.clear();
    this.damage.clear();
    this.stats.reset();
    this.match.reset();
  }

  private readonly spawnUnit = (producer: BuildingEntity, unitType: UnitTypeId): UnitEntity | null => {
    if (producer.team === 'neutral') return null;
    const target = { x: producer.position.x + (producer.team === 'player' ? 3.5 : -3.5), z: producer.position.z };
    const cell = this.navigation.findNearestWalkable(target, 8);
    if (!cell) return null;
    const unit = createUnitEntity(
      // `u` keeps produced IDs from ever colliding with scenario-authored ones.
      `${producer.team}-${unitType}-u${this.unitSequence++}`,
      unitType,
      producer.team,
      this.navigation.cellToWorld(cell),
    );
    this.state.units.add(unit);
    this.agentsBuilt[producer.team] += 1;
    this.hooks.onUnitAdded?.(unit);
    return unit;
  };

  private readonly completeBuilding = (building: BuildingEntity): void => {
    const economy = this.economy(building.team);
    if (economy) activateCapacityProvider(building, economy.capacity);
    if (building.team !== 'neutral') this.structuresBuilt[building.team] += 1;
    this.hooks.onBuildingCompleted?.(building);
  };

  /** Runs once per dead entity, after every system has finished iterating its entity list. */
  private readonly handleDeath = (record: DeathRecord): void => {
    const entity = record.entity;
    this.targets.remove(entity.id);
    this.opponent?.forget(entity.id);
    this.hooks.onDeath?.(record);
    destroyEntity(entity, {
      state: this.state,
      navigation: this.navigation,
      onUnitRemoved: (unit) => this.hooks.onUnitRemoved?.(unit),
      onBuildingRemoved: (building) => this.hooks.onBuildingRemoved?.(building),
    });
    if (!('footprint' in entity) || entity.kind !== 'core') return;
    const result = this.match.reportCoreDestroyed(entity.team, this.state.elapsedSeconds);
    if (result) this.hooks.onMatchEnd?.(result);
  };
}
