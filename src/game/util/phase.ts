import type { EntityId } from '../types/ids';

/**
 * A stable fraction in [0, 1) derived from an entity id.
 *
 * Throttled per-entity work — pursuit repathing, target acquisition — otherwise lands on the same
 * simulation step for every unit that received the same order, so a 100-unit army pays its whole
 * repath bill in one step and drops a frame. Multiplying an interval by this phase spreads the
 * same total work evenly across the interval without changing its cadence, and because it is a
 * pure function of the id it costs nothing and stays reproducible for a fixed seed.
 */
export function entityPhase(id: EntityId): number {
  const text = id as unknown as string;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1024) / 1024;
}
