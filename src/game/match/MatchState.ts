import type { Team } from '../types/simulation';

export type MatchResult = 'victory' | 'defeat';
export type MatchStatus = 'running' | MatchResult;

/** Owns the single, irreversible transition from a running match to Victory or Defeat. */
export class MatchState {
  private statusValue: MatchStatus = 'running';
  private endedAtSeconds = 0;

  get status(): MatchStatus { return this.statusValue; }
  get isOver(): boolean { return this.statusValue !== 'running'; }
  get result(): MatchResult | null { return this.statusValue === 'running' ? null : this.statusValue; }
  get endedAt(): number { return this.endedAtSeconds; }

  /** Returns the result only on the transition; later calls are ignored. */
  reportCoreDestroyed(team: Team, elapsedSeconds: number): MatchResult | null {
    if (this.isOver || team === 'neutral') return null;
    this.statusValue = team === 'player' ? 'defeat' : 'victory';
    this.endedAtSeconds = elapsedSeconds;
    return this.statusValue;
  }

  reset(): void {
    this.statusValue = 'running';
    this.endedAtSeconds = 0;
  }
}
