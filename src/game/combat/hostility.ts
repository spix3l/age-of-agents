import type { CombatTarget, SimEntity } from '../types/simulation';

/** Neutral entities are never valid combat participants on either side. */
export function isHostile(source: Pick<SimEntity, 'team'>, candidate: Pick<SimEntity, 'team' | 'alive'>): boolean {
  if (!candidate.alive) return false;
  if (source.team === 'neutral' || candidate.team === 'neutral') return false;
  return source.team !== candidate.team;
}

/** Buildings occupy a footprint, so effective range must account for their extent. */
export function targetRadius(target: CombatTarget): number {
  return 'footprint' in target ? Math.max(target.footprint.x, target.footprint.z) / 2 : target.radius;
}

export function distanceBetween(a: { position: { x: number; z: number } }, b: { position: { x: number; z: number } }): number {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}
