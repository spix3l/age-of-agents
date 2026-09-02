import { describe, expect, it } from 'vitest';
import { EconomyLedger } from './EconomyLedger';

describe('EconomyLedger', () => {
  it('spends atomically and never creates a negative balance', () => {
    const ledger = new EconomyLedger({ matter: 50, energy: 10 });
    expect(ledger.spend({ matter: 45, energy: 10 })).toBe(true);
    expect(ledger.snapshot()).toEqual({ matter: 5, energy: 0, data: 0 });
    expect(ledger.spend({ matter: 6 })).toBe(false);
    expect(ledger.balance('matter')).toBe(5);
  });

  it('tracks collected resources independently from starting reserves', () => {
    const ledger = new EconomyLedger({ matter: 25 });
    ledger.deposit('matter', 10);
    ledger.deposit('energy', 8);
    expect(ledger.snapshot()).toEqual({ matter: 35, energy: 8, data: 0 });
    expect(ledger.collectedSnapshot()).toEqual({ matter: 10, energy: 8, data: 0 });
  });
});
