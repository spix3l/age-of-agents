import { AI } from '../../data/ai';
import type { EntityId } from '../types/ids';
import type { BuildingEntity, CombatTarget, SimEntity, Team, UnitEntity, Vec2 } from '../types/simulation';

export interface RememberedTarget {
  readonly id: EntityId;
  readonly position: Vec2;
  readonly kind: string;
  lastSeenAt: number;
}

export interface ThreatReport {
  readonly target: CombatTarget;
  readonly distanceToBase: number;
}

/**
 * What the AI is allowed to act on. Resource locations may be assumed (see the backlog scope
 * decisions), but the enemy Core must be observed by one of the AI's own entities before it can
 * be attacked, so the opponent still has to scout.
 */
export class AIKnowledge {
  private enemyCore: RememberedTarget | null = null;
  private lastArmySighting: RememberedTarget | null = null;
  private readonly seenBuildings = new Map<EntityId, RememberedTarget>();

  get discoveredCore(): RememberedTarget | null { return this.enemyCore; }
  get lastKnownArmy(): RememberedTarget | null { return this.lastArmySighting; }
  get knownBuildings(): readonly RememberedTarget[] { return [...this.seenBuildings.values()]; }
  get hasDiscoveredCore(): boolean { return this.enemyCore !== null; }

  /** Records every hostile currently inside the observation radius of an owned entity. */
  observe(
    owned: readonly (UnitEntity | BuildingEntity)[],
    hostiles: readonly CombatTarget[],
    elapsedSeconds: number,
  ): void {
    for (const observer of owned) {
      const range = visionOf(observer) * AI.observationRange;
      for (const hostile of hostiles) {
        if (!hostile.alive) continue;
        if (distance(observer.position, hostile.position) > range) continue;
        this.remember(hostile, elapsedSeconds);
      }
    }
  }

  remember(target: CombatTarget, elapsedSeconds: number): void {
    const record: RememberedTarget = { id: target.id, position: { ...target.position }, kind: target.kind, lastSeenAt: elapsedSeconds };
    if ('footprint' in target) {
      this.seenBuildings.set(target.id, record);
      if (target.kind === 'core') this.enemyCore = record;
      return;
    }
    this.lastArmySighting = record;
  }

  /** Clears memories whose entity is confirmed destroyed so stale targets are never attacked. */
  forget(id: EntityId): void {
    this.seenBuildings.delete(id);
    if (this.enemyCore?.id === id) this.enemyCore = null;
    if (this.lastArmySighting?.id === id) this.lastArmySighting = null;
  }

  reset(): void {
    this.enemyCore = null;
    this.lastArmySighting = null;
    this.seenBuildings.clear();
  }
}

export function visionOf(entity: UnitEntity | BuildingEntity): number {
  return 'movementSpeed' in entity ? entity.combat.vision : entity.vision;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function isHostileTeam(team: Team, other: SimEntity['team']): boolean {
  return team !== 'neutral' && other !== 'neutral' && team !== other;
}
