import { findPath } from '../navigation/AStar';
import { COMBAT } from '../../data/combat';
import { BUILDINGS } from '../../data/buildings';
import { entityPhase } from '../util/phase';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { SpatialHash } from '../spatial/SpatialHash';
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
 * The structure standing between an attacker and something it has no route to.
 *
 * A wall only means anything if an army that cannot walk around it knocks it down instead of
 * standing in the field forever. Candidates are taken nearest-first and the first one that can
 * either be shot from here or actually be walked to wins; a structure sealed behind the same
 * fence is no more reachable than the target was, so it is skipped rather than chased.
 */
export function breachTarget(unit: UnitEntity, targets: SpatialHash<CombatTarget>, grid: NavigationGrid): CombatTarget | null {
  const blocking = targets.queryHostiles(unit.position, COMBAT.breachRadius, unit.team, (candidate) => (
    'footprint' in candidate && candidate.hp > 0 && BUILDINGS[candidate.kind].blocksNavigation
  ));
  blocking.sort((a, b) => distanceBetween(unit, a) - distanceBetween(unit, b) || a.id.localeCompare(b.id));
  for (const candidate of blocking.slice(0, COMBAT.breachCandidates)) {
    if (distanceBetween(unit, candidate) <= engagementDistance(unit, candidate)) return candidate;
    if (pursueTarget(unit, candidate, grid)) return candidate;
  }
  return null;
}

/** Points an attacker at whatever is in its way. Returns false when nothing can be reached. */
function breach(unit: UnitEntity, targets: SpatialHash<CombatTarget> | undefined, grid: NavigationGrid): boolean {
  const obstruction = targets ? breachTarget(unit, targets, grid) : null;
  if (!obstruction) return false;
  unit.combat.targetId = obstruction.id;
  unit.combat.ordered = true;
  unit.activity = distanceBetween(unit, obstruction) <= engagementDistance(unit, obstruction) ? 'Attacking' : 'Engaging';
  return true;
}

/**
 * Explicit attack order from a player or the AI. Ordered targets are pursued without a leash;
 * automatically acquired targets are handled by CombatSystem instead. An attacker with no route
 * to the target falls back to the structure blocking it, when one is within reach.
 */
export function issueAttackCommand(units: readonly UnitEntity[], target: CombatTarget, grid: NavigationGrid, targets?: SpatialHash<CombatTarget>): AttackCommandResult {
  let issued = 0;
  let rejected = 0;
  for (const unit of units) {
    if (!unit.alive || unit.combat.damage <= 0 || !isHostile(unit, target)) { rejected += 1; continue; }
    unit.gatherOrder = null;
    unit.automation = null;
    unit.combat.targetId = target.id;
    unit.combat.ordered = true;
    unit.combat.repathCooldown = COMBAT.repathInterval * entityPhase(unit.id) * 0.5;
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
    } else if (breach(unit, targets, grid)) {
      issued += 1;
    } else {
      unit.combat.targetId = null;
      unit.combat.ordered = false;
      rejected += 1;
    }
  }
  return { issued, rejected };
}
