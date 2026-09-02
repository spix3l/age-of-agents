import type { UnitEntity } from '../types/simulation';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { findPath } from '../navigation/AStar';

export class MovementSystem {
  constructor(private readonly grid: NavigationGrid) {}

  update(units: readonly UnitEntity[], delta: number): void {
    for (const unit of units) {
      if (!unit.alive || unit.pathIndex >= unit.path.length) continue;
      unit.previousPosition.x = unit.position.x;
      unit.previousPosition.z = unit.position.z;
      const waypoint = unit.path[unit.pathIndex];
      if (!waypoint) continue;
      const dx = waypoint.x - unit.position.x;
      const dz = waypoint.z - unit.position.z;
      const distance = Math.hypot(dx, dz);
      const travel = unit.movementSpeed * delta;

      if (distance <= Math.max(0.08, travel)) {
        unit.position.x = waypoint.x;
        unit.position.z = waypoint.z;
        unit.pathIndex += 1;
        unit.stuckSeconds = 0;
        if (unit.pathIndex >= unit.path.length) unit.destination = null;
      } else {
        unit.position.x += (dx / distance) * travel;
        unit.position.z += (dz / distance) * travel;
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
}
