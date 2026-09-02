import { BUILDINGS } from '../../../data/buildings';
import type { EntityId, BuildingTypeId } from '../../types/ids';
import type { BuildingEntity, Team, Vec2 } from '../../types/simulation';

export function createBuildingSite(id: EntityId, type: Exclude<BuildingTypeId, 'core'>, team: Exclude<Team, 'neutral'>, position: Vec2, builderId: EntityId): BuildingEntity {
  const config = BUILDINGS[type];
  return {
    id, kind: type, team, alive: true,
    position: { ...position }, previousPosition: { ...position },
    hp: Math.max(1, Math.round(config.maxHp * 0.05)), maxHp: config.maxHp,
    footprint: { x: config.footprint[0], z: config.footprint[1] },
    vision: 4, acceptsDeposits: false, capacityContribution: config.capacityContribution,
    selected: false, productionQueue: [], operational: false, constructionProgress: 0,
    constructionTime: config.constructionTime, builderId, capacityApplied: false,
  };
}
