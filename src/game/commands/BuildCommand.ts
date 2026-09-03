import { BUILDINGS, BUILDING_FOOTPRINT_PADDING } from '../../data/buildings';
import { validatePlacement, type PlaceableBuildingType, type PlacementFailure } from '../building/PlacementController';
import { createBuildingSite } from '../entities/buildings/Building';
import type { GameState } from '../GameState';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { ConstructionSystem } from '../systems/ConstructionSystem';
import type { EntityId } from '../types/ids';
import type { BuildingEntity, Team, UnitEntity, Vec2 } from '../types/simulation';

export type BuildRejection = 'INVALID_WORKER' | 'INVALID_PLACEMENT' | 'INSUFFICIENT_RESOURCES' | 'NO_BUILD_PATH' | 'LOCKED';
export type BuildCommandResult =
  | { readonly ok: true; readonly site: BuildingEntity }
  | { readonly ok: false; readonly reason: BuildRejection; readonly failure?: PlacementFailure };

export interface BuildCommandContext {
  readonly state: GameState;
  readonly navigation: NavigationGrid;
  readonly construction: ConstructionSystem;
  readonly nextBuildingId: (type: PlaceableBuildingType, team: Exclude<Team, 'neutral'>) => EntityId;
  readonly canBuild?: (type: PlaceableBuildingType, team: Exclude<Team, 'neutral'>) => boolean;
  readonly onCreated?: (site: BuildingEntity) => void;
  readonly onRemoved?: (site: BuildingEntity) => void;
}

/**
 * The single build transaction for players and AI: validate, spend, create the
 * navigation-blocking site, and assign a builder. A failed assignment rolls everything back.
 */
export function issueBuildCommand(
  worker: UnitEntity,
  type: PlaceableBuildingType,
  position: Vec2,
  team: Exclude<Team, 'neutral'>,
  context: BuildCommandContext,
): BuildCommandResult {
  if (!worker.alive || worker.kind !== 'worker' || worker.team !== team) return { ok: false, reason: 'INVALID_WORKER' };
  const economy = context.state.economies.get(team);
  if (!economy) return { ok: false, reason: 'INVALID_WORKER' };
  if (context.canBuild && !context.canBuild(type, team)) return { ok: false, reason: 'LOCKED' };

  const placement = validatePlacement(type, position, context.navigation, context.state.buildings.alive(), context.state.resources.alive());
  if (!placement.valid) return { ok: false, reason: 'INVALID_PLACEMENT', failure: placement.failure };

  const config = BUILDINGS[type];
  if (!economy.ledger.spend(config.cost)) return { ok: false, reason: 'INSUFFICIENT_RESOURCES' };

  const site = createBuildingSite(context.nextBuildingId(type, team), type, team, placement.position, worker.id);
  context.state.buildings.add(site);
  context.navigation.setBlockedRect(site.position, site.footprint, true, BUILDING_FOOTPRINT_PADDING);
  context.onCreated?.(site);

  if (!context.construction.assign(worker, site)) {
    context.navigation.setBlockedRect(site.position, site.footprint, false, BUILDING_FOOTPRINT_PADDING);
    context.state.buildings.destroy(site.id);
    context.onRemoved?.(site);
    economy.ledger.refund(config.cost);
    return { ok: false, reason: 'NO_BUILD_PATH' };
  }
  return { ok: true, site };
}
