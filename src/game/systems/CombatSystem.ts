import { COMBAT } from '../../data/combat';
import { engagementDistance, pursueTarget } from '../commands/AttackCommand';
import type { DamageService } from '../combat/DamageService';
import { distanceBetween, isHostile } from '../combat/hostility';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { EntityId } from '../types/ids';
import type { CombatTarget, UnitEntity } from '../types/simulation';

export interface CombatSystemDeps {
  readonly targets: SpatialHash<CombatTarget>;
  readonly lookup: (id: EntityId) => CombatTarget | undefined;
  readonly damage: DamageService;
  readonly grid: NavigationGrid;
  /** Presentation hook. Effects never decide whether a hit landed. */
  readonly onShot?: (attacker: UnitEntity, target: CombatTarget) => void;
}

/** Acquire → move into range → attack → cooldown → retarget. */
export class CombatSystem {
  constructor(private readonly deps: CombatSystemDeps) {}

  update(units: readonly UnitEntity[], delta: number): void {
    for (const unit of units) {
      if (!unit.alive) continue;
      const combat = unit.combat;
      combat.cooldown = Math.max(0, combat.cooldown - delta);
      combat.acquireCooldown = Math.max(0, combat.acquireCooldown - delta);
      combat.repathCooldown = Math.max(0, combat.repathCooldown - delta);
      if (combat.damage <= 0) continue;

      let target = this.resolveTarget(unit);
      if (!target) target = this.retaliate(unit);
      if (!target) target = this.acquire(unit);
      if (!target) {
        if (unit.activity === 'Attacking' || unit.activity === 'Engaging') unit.activity = unit.destination ? 'Moving' : 'Idle';
        continue;
      }
      this.engage(unit, target);
    }
  }

  /** Drops targets that died, were unregistered, or drifted outside an auto-acquired leash. */
  private resolveTarget(unit: UnitEntity): CombatTarget | null {
    const combat = unit.combat;
    if (!combat.targetId) return null;
    const target = this.deps.lookup(combat.targetId);
    if (!target || !target.alive || !isHostile(unit, target)) {
      combat.targetId = null;
      const wasOrdered = combat.ordered;
      combat.ordered = false;
      return wasOrdered || combat.autoAcquires ? this.retarget(unit, COMBAT.retargetRadius) : null;
    }
    const leash = combat.autoAcquires ? combat.vision * 1.5 : COMBAT.defensivePursuit;
    if (!combat.ordered && distanceBetween(unit, target) > leash) {
      // A Worker shoots what is already on top of it, but never abandons its job to chase.
      combat.targetId = null;
      return null;
    }
    return target;
  }

  /**
   * Anything that can shoot defends itself, including Workers. Self-defense never overrides an
   * explicit order and never makes a non-combat Agent chase its attacker.
   */
  private retaliate(unit: UnitEntity): CombatTarget | null {
    const attackerId = unit.combat.lastAttackerId;
    if (!attackerId) return null;
    const attacker = this.deps.lookup(attackerId);
    if (!attacker?.alive || !isHostile(unit, attacker)) {
      unit.combat.lastAttackerId = null;
      return null;
    }
    if (distanceBetween(unit, attacker) > unit.combat.vision) return null;
    unit.combat.targetId = attacker.id;
    return attacker;
  }

  /**
   * Idle Agents pick their own targets: combat units across their whole vision, everything else
   * only within arm's reach of where they are standing. A busy Agent acquires nothing and is
   * limited to returning fire.
   */
  private acquire(unit: UnitEntity): CombatTarget | null {
    const combat = unit.combat;
    if (combat.acquireCooldown > 0) return null;
    if (unit.gatherOrder || unit.buildOrder || unit.automation || unit.destination) return null;
    combat.acquireCooldown = COMBAT.acquisitionInterval;
    return this.retarget(unit, combat.autoAcquires ? combat.vision : COMBAT.defensivePursuit);
  }

  private retarget(unit: UnitEntity, radius: number): CombatTarget | null {
    const found = this.deps.targets.nearestHostile(unit.position, radius, unit.team, (candidate) => candidate.hp > 0);
    if (!found) return null;
    unit.combat.targetId = found.id;
    unit.combat.repathCooldown = 0;
    return found;
  }

  private engage(unit: UnitEntity, target: CombatTarget): void {
    const combat = unit.combat;
    const stopDistance = engagementDistance(unit, target);
    const distance = distanceBetween(unit, target);

    if (distance <= stopDistance) {
      // Stop to shoot, but leave gather/build orders intact so the job resumes afterwards.
      if (unit.destination) {
        unit.path = [];
        unit.pathIndex = 0;
        unit.destination = null;
      }
      unit.activity = 'Attacking';
      if (combat.cooldown > 0) return;
      const result = this.deps.damage.apply(unit, target, combat.damage);
      if (!result.ok) {
        combat.targetId = null;
        return;
      }
      combat.cooldown = combat.cooldownTime;
      this.deps.onShot?.(unit, target);
      return;
    }

    // A Worker will take a step toward an attacker that outranges it, but no further.
    if (!combat.ordered && !combat.autoAcquires && distance > COMBAT.defensivePursuit) {
      combat.targetId = null;
      return;
    }
    unit.activity = 'Engaging';
    const needsPath = !unit.destination || distance > stopDistance + COMBAT.rangeTolerance;
    if (!needsPath || combat.repathCooldown > 0) return;
    combat.repathCooldown = COMBAT.repathInterval;
    if (!pursueTarget(unit, target, this.deps.grid)) {
      combat.targetId = null;
      combat.ordered = false;
      unit.activity = 'Idle';
    }
  }
}
