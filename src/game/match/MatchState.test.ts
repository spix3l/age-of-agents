import { describe, expect, it } from 'vitest';
import { MatchState } from './MatchState';

describe('MatchState', () => {
  it('ends exactly once and ignores later Core losses', () => {
    const match = new MatchState();
    expect(match.status).toBe('running');
    expect(match.reportCoreDestroyed('enemy', 42)).toBe('victory');
    expect(match.reportCoreDestroyed('player', 51)).toBeNull();
    expect(match.status).toBe('victory');
    expect(match.endedAt).toBe(42);
    expect(match.isOver).toBe(true);
  });

  it('reports Defeat when the player Core falls and resets cleanly', () => {
    const match = new MatchState();
    expect(match.reportCoreDestroyed('player', 12)).toBe('defeat');
    expect(match.result).toBe('defeat');
    match.reset();
    expect(match.status).toBe('running');
    expect(match.result).toBeNull();
    expect(match.endedAt).toBe(0);
  });

  it('ignores neutral entities', () => {
    const match = new MatchState();
    expect(match.reportCoreDestroyed('neutral', 5)).toBeNull();
    expect(match.isOver).toBe(false);
  });
});
