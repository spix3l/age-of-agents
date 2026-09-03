import { describe, expect, it } from 'vitest';
import { formatDuration, formatMatchSummary } from './matchShare';
import { EMPTY_MATCH_SUMMARY } from '../store';

const summary = {
  ...EMPTY_MATCH_SUMMARY,
  durationSeconds: 754,
  matterCollected: 1_820.6,
  energyCollected: 940.2,
  dataCollected: 305.9,
  agentsCreated: 41,
  agentsKilled: 33,
  agentsLost: 27,
  buildingsConstructed: 12,
  buildingsDestroyed: 6,
  buildingsLost: 2,
  finalGeneration: 3 as const,
};

describe('match sharing', () => {
  it('formats a duration as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(-5)).toBe('00:00');
  });

  it('reports every recorded statistic and the seed', () => {
    const text = formatMatchSummary({ result: 'victory', summary, difficulty: 'relentless', seed: 918_273 });
    expect(text).toContain('VICTORY in 12:34');
    expect(text).toContain('RELENTLESS');
    expect(text).toContain('Generation 3');
    expect(text).toContain('1820 matter');
    expect(text).toContain('940 energy');
    expect(text).toContain('305 data');
    expect(text).toContain('41 built');
    expect(text).toContain('33 destroyed');
    expect(text).toContain('27 lost');
    expect(text).toContain('12 built');
    // The seed is the point: it is what lets someone play the same map.
    expect(text).toContain('Seed: 918273');
  });

  it('says DEFEAT for a lost match', () => {
    const text = formatMatchSummary({ result: 'defeat', summary, difficulty: 'standard', seed: 1 });
    expect(text).toContain('DEFEAT');
    expect(text).not.toContain('VICTORY');
  });
});
