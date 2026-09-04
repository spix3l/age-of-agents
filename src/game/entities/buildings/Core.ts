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
    footprint: { x: config.footprint[0], z: config.footprint[1] }, rotated: false,
    vision: config.vision,
    acceptsDeposits: config.acceptsDeposits,
    capacityContribution: CORE_CAPACITY,
    capacityUse: config.capacityUse,
    selected: false,
    productionQueue: [],
    operational: true,
    constructionProgress: 1,
    constructionTime: 0,
    builderId: null,
    capacityApplied: true,
    synthesisPaused: false,
    // A Core shoots back. It is the one structure a colony cannot afford to lose, and a raid that
    // walks up to an unarmed one for free makes early defence a formality rather than a decision.
    combat: { damage: config.attackDamage, range: config.attackRange, cooldownTime: config.attackCooldown, cooldown: 0, targetId: null },
  };
}
