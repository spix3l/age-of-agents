import type { Team, SimEntity } from '../../types/simulation';

export function ownedBy<T extends SimEntity>(entities: readonly T[], team: Team): readonly T[] {
  return entities.filter((entity) => entity.alive && entity.team === team);
}
