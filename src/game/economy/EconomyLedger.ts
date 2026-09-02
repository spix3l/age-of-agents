import type { ResourceCost, ResourceType } from '../types/simulation';

export type ResourceBalances = Record<ResourceType, number>;

export class EconomyLedger {
  private readonly balances: ResourceBalances;
  private readonly collected: ResourceBalances = { matter: 0, energy: 0, data: 0 };

  constructor(initial: ResourceCost = {}) {
    this.balances = { matter: initial.matter ?? 0, energy: initial.energy ?? 0, data: initial.data ?? 0 };
    this.assertNonNegative(this.balances);
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
