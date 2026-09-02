import type { EntityId } from '../types/ids';
import type { CombatTarget, Team } from '../types/simulation';
import { isHostile } from './hostility';
import type { MatchStats } from './MatchStats';

export type DamageRejection = 'DEAD_TARGET' | 'FRIENDLY_FIRE' | 'INVALID_AMOUNT';
export type DamageResult =
  | { readonly ok: true; readonly applied: number; readonly lethal: boolean }
  | { readonly ok: false; readonly reason: DamageRejection };

export interface DeathRecord {
  readonly entity: CombatTarget;
  readonly killer: Team;
}

/**
 * Single writer for HP changes. Damage never removes an entity inline: lethal hits are queued
 * so systems can finish iterating their current entity list before anything is unregistered.
 */
export class DamageService {
  private readonly pending: DeathRecord[] = [];
  private readonly queued = new Set<EntityId>();

  constructor(private readonly stats?: MatchStats) {}

  apply(attacker: { team: Team }, target: CombatTarget, amount: number): DamageResult {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'INVALID_AMOUNT' };
    if (!target.alive || target.hp <= 0) return { ok: false, reason: 'DEAD_TARGET' };
    if (!isHostile(attacker, target)) return { ok: false, reason: 'FRIENDLY_FIRE' };
    const applied = Math.min(amount, target.hp);
    target.hp = Math.max(0, target.hp - amount);
    this.stats?.recordDamage(attacker.team, applied);
    if (target.hp > 0) return { ok: true, applied, lethal: false };
    this.enqueueDeath(target, attacker.team);
    return { ok: true, applied, lethal: true };
  }

  get pendingDeaths(): number { return this.pending.length; }

  /** Drains the queue, invoking the handler exactly once per entity. */
  processDeaths(handle: (record: DeathRecord) => void): number {
    if (this.pending.length === 0) return 0;
    const records = this.pending.splice(0, this.pending.length);
    this.queued.clear();
    for (const record of records) {
      this.stats?.recordKill(record.killer, record.entity.team, 'footprint' in record.entity);
      handle(record);
    }
    return records.length;
  }

  clear(): void {
    this.pending.length = 0;
    this.queued.clear();
  }

  private enqueueDeath(entity: CombatTarget, killer: Team): void {
    if (this.queued.has(entity.id)) return;
    this.queued.add(entity.id);
    this.pending.push({ entity, killer });
  }
}
