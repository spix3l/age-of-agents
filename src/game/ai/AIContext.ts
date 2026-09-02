import { automateWorkers } from '../commands/AutomateCommand';
import { issueGatherCommand } from '../commands/GatherCommand';
import { issueMoveCommand } from '../commands/MoveCommand';
import type { BuildCommandResult } from '../commands/BuildCommand';
import type { PlaceableBuildingType } from '../building/PlacementController';
import type { MatchSimulation } from '../match/MatchSimulation';
import type { ResourceNodeEntity } from '../entities/resources/ResourceNode';
import type { EnqueueResult } from '../systems/ProductionSystem';
import type { UnitTypeId } from '../types/ids';
import type { BuildingEntity, CombatTarget, HarvestableResourceType, Team, UnitEntity, Vec2 } from '../types/simulation';
import type { NavigationGrid } from '../navigation/NavigationGrid';

export type PlayableTeam = Exclude<Team, 'neutral'>;

/** Read-only view of the match from one faction's perspective. */
export interface AIView {
  readonly team: PlayableTeam;
  readonly elapsedSeconds: number;
  readonly navigation: NavigationGrid;
  units(): readonly UnitEntity[];
  buildings(): readonly BuildingEntity[];
  /** Every live building on the map; placement validity is not faction-scoped. */
  allBuildings(): readonly BuildingEntity[];
  core(): BuildingEntity | undefined;
  hostiles(): readonly CombatTarget[];
  resources(): readonly ResourceNodeEntity[];
  balances(): { readonly matter: number; readonly energy: number };
  capacity(): { readonly used: number; readonly reserved: number; readonly max: number };
  canAssign(building: BuildingEntity, worker: UnitEntity): boolean;
}

/**
 * The only mutation surface the AI is given. Every entry point is a command that a human
 * player can also issue, so the opponent cannot cheat by writing entity or ledger state.
 */
export interface AICommands {
  gather(workers: readonly UnitEntity[], node: ResourceNodeEntity): number;
  automate(workers: readonly UnitEntity[], resourceType: HarvestableResourceType): number;
  move(units: readonly UnitEntity[], target: Vec2): number;
  attack(units: readonly UnitEntity[], target: CombatTarget): number;
  build(worker: UnitEntity, type: PlaceableBuildingType, position: Vec2): BuildCommandResult;
  assignBuilder(worker: UnitEntity, site: BuildingEntity): boolean;
  produce(producer: BuildingEntity, unitType: UnitTypeId): EnqueueResult;
}

export interface AIContext {
  readonly view: AIView;
  readonly commands: AICommands;
}

export function createAIContext(simulation: MatchSimulation, team: PlayableTeam): AIContext {
  const view: AIView = {
    team,
    navigation: simulation.navigation,
    get elapsedSeconds() { return simulation.elapsedSeconds; },
    units: () => simulation.unitsOf(team),
    buildings: () => simulation.buildingsOf(team),
    allBuildings: () => simulation.state.buildings.alive(),
    core: () => simulation.coreOf(team),
    hostiles: () => [
      ...simulation.state.units.alive().filter((unit) => unit.team !== team && unit.team !== 'neutral'),
      ...simulation.state.buildings.alive().filter((building) => building.team !== team && building.team !== 'neutral'),
    ],
    resources: () => simulation.state.resources.alive(),
    balances: () => {
      const snapshot = simulation.economy(team)?.ledger.snapshot();
      return { matter: snapshot?.matter ?? 0, energy: snapshot?.energy ?? 0 };
    },
    capacity: () => simulation.economy(team)?.capacity.snapshot() ?? { used: 0, reserved: 0, max: 0 },
    canAssign: (building, worker) => building.alive && !building.operational && worker.alive && worker.kind === 'worker',
  };

  const commands: AICommands = {
    gather: (workers, node) => issueGatherCommand(workers, node, simulation.navigation).issued,
    automate: (workers, resourceType) => automateWorkers(workers, resourceType),
    move: (units, target) => issueMoveCommand(units, target, simulation.navigation).issued,
    attack: (units, target) => simulation.attack(units, target),
    build: (worker, type, position) => simulation.build(worker, type, position),
    assignBuilder: (worker, site) => simulation.construction.assign(worker, site),
    produce: (producer, unitType) => simulation.enqueue(producer, unitType),
  };

  return { view, commands };
}
