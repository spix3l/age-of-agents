import type { DamageService } from '../combat/DamageService';
import { distanceBetween, isHostile } from '../combat/hostility';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { EntityId } from '../types/ids';
import type { BuildingEntity, CombatTarget } from '../types/simulation';

export interface TurretSystemDeps {
  readonly targets: SpatialHash<CombatTarget>;
  readonly lookup: (id: EntityId) => CombatTarget | undefined;
  readonly damage: DamageService;
  readonly onShot?: (attacker: BuildingEntity, target: CombatTarget) => void;
}

/** Fixed-step stationary defense. Turrets never path and acquire at their fire cadence. */
export class TurretSystem {
  constructor(private readonly deps: TurretSystemDeps) {}

  update(buildings: readonly BuildingEntity[], delta: number): void {
    for (const turret of buildings) {
      const combat = turret.combat;
      if (!turret.alive || !turret.operational || !combat) continue;
      combat.cooldown = Math.max(0, combat.cooldown - delta);
      // A target that walked out of range is dropped immediately, so one surviving runner can
      // never leave the turret locked onto it while other hostiles stand inside its arc.
      const previous = combat.targetId ? this.deps.lookup(combat.targetId) : undefined;
      const target = previous && isHostile(turret, previous) && distanceBetween(turret, previous) <= combat.range
        ? previous
        : this.deps.targets.nearestHostile(turret.position, combat.range, turret.team, (candidate) => candidate.hp > 0);
      combat.targetId = target?.id ?? null;
      if (!target || combat.cooldown > 0) continue;
      const result = this.deps.damage.apply(turret, target, combat.damage);
      if (!result.ok) { combat.targetId = null; continue; }
      combat.cooldown = combat.cooldownTime;
      this.deps.onShot?.(turret, target);
    }
  }
}
