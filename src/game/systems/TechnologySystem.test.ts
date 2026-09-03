import { describe, expect, it } from 'vitest';
import { GENERATIONS } from '../../data/technologies';
import { EconomyLedger } from '../economy/EconomyLedger';
import type { Generation } from '../types/simulation';
import { TechnologySystem } from './TechnologySystem';

describe('Generation progression', () => {
  it('spends centralized costs and advances through all three Generations', () => {
    const generations = new Map<'player' | 'enemy', Generation>([['player', 1], ['enemy', 1]]);
    const technology = new TechnologySystem(generations);
    const ledger = new EconomyLedger({ matter: 500, energy: 400, data: 160 });

    expect(technology.canBuild('player', 'turret')).toBe(false);
    expect(technology.advance('player', ledger)).toEqual({ ok: true, generation: 2 });
    expect(technology.canBuild('player', 'turret')).toBe(true);
    expect(technology.canProduce('player', 'ranger')).toBe(true);
    expect(technology.canProduce('player', 'scout')).toBe(true);
    expect(technology.advance('player', ledger)).toEqual({ ok: true, generation: 3 });
    expect(technology.canBuild('player', 'foundry')).toBe(true);
    expect(technology.canProduce('player', 'titan')).toBe(true);
    expect(technology.advance('player', ledger)).toEqual({ ok: false, reason: 'MAX_GENERATION' });
    expect(ledger.snapshot()).toEqual({ matter: 0, energy: 80, data: 20 });
  });

  it('never spends on a rejected advance', () => {
    const generations = new Map<'player' | 'enemy', Generation>([['player', 1], ['enemy', 1]]);
    const technology = new TechnologySystem(generations);
    const ledger = new EconomyLedger({ data: GENERATIONS[1].advanceCost!.data! - 1 });
    expect(technology.advance('player', ledger)).toEqual({ ok: false, reason: 'INSUFFICIENT_RESOURCES' });
    expect(technology.current('player')).toBe(1);
    expect(ledger.balance('data')).toBe(39);
  });
});
