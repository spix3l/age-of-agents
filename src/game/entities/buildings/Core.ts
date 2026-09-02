import { BUILDINGS } from '../../../data/buildings';
import type { EntityId } from '../../types/ids';
import type { BuildingEntity, Team, Vec2 } from '../../types/simulation';

export const CORE_VISION = 14;
export const CORE_CAPACITY = 8;

export function createCore(id: EntityId, team: Exclude<Team, 'neutral'>, position: Vec2): BuildingEntity {
  const config = BUILDINGS.core;
  return {
    id,
    kind: 'core',
    team,
    alive: true,
    position: { ...position },
    previousPosition: { ...position },
    hp: config.maxHp,
    maxHp: config.maxHp,
    footprint: { x: config.footprint[0], z: config.footprint[1] },
    vision: CORE_VISION,
    acceptsDeposits: true,
    capacityContribution: CORE_CAPACITY,
    selected: false,
    productionQueue: [],
    operational: true,
    constructionProgress: 1,
    constructionTime: 0,
    builderId: null,
    capacityApplied: true,
  };
}
