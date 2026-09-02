import { findPath } from '../navigation/AStar';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import { distanceBetween, isHostile, targetRadius } from '../combat/hostility';
import type { CombatTarget, UnitEntity, Vec2 } from '../types/simulation';

export interface AttackCommandResult {
  readonly issued: number;
  readonly rejected: number;
}

/** Stopping distance that keeps an attacker just inside weapon range of a target's hull. */
export function engagementDistance(unit: UnitEntity, target: CombatTarget): number {
  return unit.combat.range + targetRadius(target) + unit.radius;
}

export function approachPoint(unit: UnitEntity, target: CombatTarget): Vec2 {
  const dx = unit.position.x - target.position.x;
  const dz = unit.position.z - target.position.z;
  const length = Math.hypot(dx, dz) || 1;
  const distance = Math.max(0.6, engagementDistance(unit, target) * 0.8);
  return { x: target.position.x + (dx / length) * distance, z: target.position.z + (dz / length) * distance };
}

/** Routes an attacker toward its target. Returns false when no walkable approach exists. */
export function pursueTarget(unit: UnitEntity, target: CombatTarget, grid: NavigationGrid): boolean {
  const cell = grid.findNearestWalkable(approachPoint(unit, target), 10);
  if (!cell) return false;
  const destination = grid.cellToWorld(cell);
  const path = findPath(grid, unit.position, destination);
  if (path.length === 0) return false;
  unit.path = path;
  unit.pathIndex = path.length > 1 ? 1 : 0;
  unit.destination = destination;
  unit.stuckSeconds = 0;
  unit.repathCount = 0;
  return true;
}

/**
 * Explicit attack order from a player or the AI. Ordered targets are pursued without a leash;
 * automatically acquired targets are handled by CombatSystem instead.
 */
export function issueAttackCommand(units: readonly UnitEntity[], target: CombatTarget, grid: NavigationGrid): AttackCommandResult {
  let issued = 0;
  let rejected = 0;
  for (const unit of units) {
    if (!unit.alive || unit.combat.damage <= 0 || !isHostile(unit, target)) { rejected += 1; continue; }
    unit.gatherOrder = null;
    unit.automation = null;
    unit.combat.targetId = target.id;
    unit.combat.ordered = true;
    unit.combat.repathCooldown = 0;
    const inRange = distanceBetween(unit, target) <= engagementDistance(unit, target);
    if (inRange) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.destination = null;
      unit.activity = 'Attacking';
      issued += 1;
      continue;
    }
    if (pursueTarget(unit, target, grid)) {
      unit.activity = 'Engaging';
      issued += 1;
    } else {
      unit.combat.targetId = null;
      unit.combat.ordered = false;
      rejected += 1;
    }
  }
  return { issued, rejected };
}
