import type { UnitEntity, Vec2 } from '../types/simulation';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { findPath } from '../navigation/AStar';

/** Repaths one unit may attempt after walking into something before it gives the route up. */
const BLOCKED_REPATHS = 3;

export class MovementSystem {
  constructor(private readonly grid: NavigationGrid) {}

  update(units: readonly UnitEntity[], delta: number): void {
    for (const unit of units) {
      if (!unit.alive) continue;
      // Synced for every living unit, not only movers: the renderer derives the walk cycle from
      // position - previousPosition, so once a path ran out the frozen last delta kept idle
      // units playing their walking animation forever.
      unit.previousPosition.x = unit.position.x;
      unit.previousPosition.z = unit.position.z;
      if (unit.pathIndex >= unit.path.length) continue;
      const waypoint = unit.path[unit.pathIndex];
      if (!waypoint) continue;
      const dx = waypoint.x - unit.position.x;
      const dz = waypoint.z - unit.position.z;
      const distance = Math.hypot(dx, dz);
      const travel = unit.movementSpeed * delta;
      const arriving = distance <= Math.max(0.08, travel);
      const next = arriving
        ? { x: waypoint.x, z: waypoint.z }
        : { x: unit.position.x + (dx / distance) * travel, z: unit.position.z + (dz / distance) * travel };

      // A route is planned once and then walked for seconds. Without this check a wall raised
      // across a route already being walked is simply walked through, because nothing between
      // the planner and the renderer ever looks at the grid again.
      if (this.refuses(unit.position, next)) {
        this.reroute(unit);
        continue;
      }

      unit.position.x = next.x;
      unit.position.z = next.z;
      if (arriving) {
        unit.pathIndex += 1;
        unit.stuckSeconds = 0;
        if (unit.pathIndex >= unit.path.length) {
          unit.destination = null;
          if (!unit.gatherOrder) unit.activity = 'Idle';
        }
      } else {
        const moved = Math.hypot(unit.position.x - unit.previousPosition.x, unit.position.z - unit.previousPosition.z);
        unit.stuckSeconds = moved < 0.001 ? unit.stuckSeconds + delta : 0;
      }

      if (unit.stuckSeconds > 0.75 && unit.destination && unit.repathCount < 2) {
        unit.path = findPath(this.grid, unit.position, unit.destination);
        unit.pathIndex = unit.path.length > 1 ? 1 : 0;
        unit.repathCount += 1;
        unit.stuckSeconds = 0;
      }
    }
  }

  /**
   * Whether a step would carry a unit off open ground into a blocked cell.
   *
   * Leaving a blocked cell is always allowed. A unit can legitimately be standing in one — walled
   * in by a structure raised around it, or nudged inside a footprint's clearance — and refusing
   * every step out of it would strand it there for the rest of the match.
   */
  private refuses(from: Vec2, to: Vec2): boolean {
    const target = this.grid.worldToCell(to);
    if (this.grid.isWalkable(target)) return false;
    const origin = this.grid.worldToCell(from);
    if (origin.col === target.col && origin.row === target.row) return false;
    return this.grid.isWalkable(origin);
  }

  /** Walked into something: plan around it, or stop and let the owner give a new order. */
  private reroute(unit: UnitEntity): void {
    unit.path = [];
    unit.pathIndex = 0;
    unit.stuckSeconds = 0;
    const destination = unit.destination;
    const path = destination && unit.repathCount < BLOCKED_REPATHS ? findPath(this.grid, unit.position, destination) : [];
    if (path.length === 0) {
      unit.destination = null;
      // Gather and build orders own their own re-approach; only a bare move is finished here.
      if (!unit.gatherOrder && !unit.buildOrder) unit.activity = 'Idle';
      return;
    }
    unit.repathCount += 1;
    unit.path = path;
    unit.pathIndex = path.length > 1 ? 1 : 0;
  }
}
