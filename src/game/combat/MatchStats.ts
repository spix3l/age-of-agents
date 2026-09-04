import type { Team } from '../types/simulation';

export interface TeamStats {
  unitsLost: number;
  unitsKilled: number;
  buildingsLost: number;
  buildingsDestroyed: number;
  damageDealt: number;
}

function emptyStats(): TeamStats {
  return { unitsLost: 0, unitsKilled: 0, buildingsLost: 0, buildingsDestroyed: 0, damageDealt: 0 };
}

/** Attribution of kills and losses. Written by DamageService, read by the HUD and end screen. */
export class MatchStats {
  private readonly teams = new Map<Exclude<Team, 'neutral'>, TeamStats>([
    ['player', emptyStats()],
    ['enemy', emptyStats()],
  ]);

  for(team: Team): TeamStats | undefined {
    return team === 'neutral' ? undefined : this.teams.get(team);
  }

  recordDamage(team: Team, amount: number): void {
    const stats = this.for(team);
    if (stats) stats.damageDealt += amount;
  }

  recordKill(killer: Team, victim: Team, victimIsBuilding: boolean): void {
    const attacker = this.for(killer);
    const loser = this.for(victim);
    if (attacker) {
      if (victimIsBuilding) attacker.buildingsDestroyed += 1;
      else attacker.unitsKilled += 1;
    }
    if (loser) {
      if (victimIsBuilding) loser.buildingsLost += 1;
      else loser.unitsLost += 1;
    }
  }

  snapshot(team: Exclude<Team, 'neutral'>): Readonly<TeamStats> {
    return { ...(this.teams.get(team) ?? emptyStats()) };
  }

  /** Adopts a saved tally, so a restored match keeps the kills and losses it already earned. */
  restore(team: Exclude<Team, 'neutral'>, stats: TeamStats): void {
    this.teams.set(team, { ...stats });
  }

  reset(): void {
    this.teams.set('player', emptyStats());
    this.teams.set('enemy', emptyStats());
  }
}
