import type { ResourceCost, ResourceType } from '../types/simulation';

export type ResourceBalances = Record<ResourceType, number>;

export class EconomyLedger {
  private readonly balances: ResourceBalances;
  private readonly collected: ResourceBalances = { matter: 0, energy: 0, data: 0 };

  /**
   * `collected` seeds the cumulative totals. It is only ever passed when a saved match is being
   * restored: the HUD's income readout and the end screen both report lifetime totals, and a
   * loaded game that claims to have collected nothing would throw both of them away.
   */
  constructor(initial: ResourceCost = {}, collected?: ResourceCost) {
    this.balances = { matter: initial.matter ?? 0, energy: initial.energy ?? 0, data: initial.data ?? 0 };
    this.assertNonNegative(this.balances);
    if (collected) {
      this.collected.matter = collected.matter ?? 0;
      this.collected.energy = collected.energy ?? 0;
      this.collected.data = collected.data ?? 0;
      this.assertNonNegative(this.collected);
    }
  }

  balance(type: ResourceType): number { return this.balances[type]; }
  totalCollected(type: ResourceType): number { return this.collected[type]; }
  snapshot(): Readonly<ResourceBalances> { return { ...this.balances }; }
  collectedSnapshot(): Readonly<ResourceBalances> { return { ...this.collected }; }

  canAfford(cost: ResourceCost): boolean {
    return (Object.entries(cost) as [ResourceType, number][]).every(([type, amount]) => this.balance(type) >= amount);
  }

  spend(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const [type, amount] of Object.entries(cost) as [ResourceType, number][]) this.balances[type] -= amount;
    return true;
  }

  deposit(type: ResourceType, amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Deposit must be a finite non-negative amount');
    this.balances[type] += amount;
    this.collected[type] += amount;
  }

  refund(cost: ResourceCost): void {
    for (const [type, amount] of Object.entries(cost) as [ResourceType, number][]) this.balances[type] += amount;
  }

  private assertNonNegative(values: ResourceBalances): void {
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Economy balances cannot be negative');
  }
}
