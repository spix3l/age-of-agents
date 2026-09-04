export interface CapacitySnapshot { readonly used: number; readonly reserved: number; readonly max: number }

export class Capacity {
  private usedValue: number;
  private reservedValue = 0;
  private maxValue: number;

  constructor(max: number, used = 0) {
    if (max < 0 || used < 0) throw new Error('Capacity values cannot be negative');
    this.maxValue = max;
    this.usedValue = used;
  }

  snapshot(): CapacitySnapshot { return { used: this.usedValue, reserved: this.reservedValue, max: this.maxValue }; }
  canReserve(amount: number): boolean { return amount >= 0 && this.usedValue + this.reservedValue + amount <= this.maxValue; }

  reserve(amount: number): boolean {
    if (!this.canReserve(amount)) return false;
    this.reservedValue += amount;
    return true;
  }

  commit(amount: number): void {
    if (amount < 0 || amount > this.reservedValue) throw new Error('Cannot commit unreserved capacity');
    this.reservedValue -= amount;
    this.usedValue += amount;
  }

  cancel(amount: number): void { this.reservedValue = Math.max(0, this.reservedValue - Math.max(0, amount)); }
  releaseUsed(amount: number): void { this.usedValue = Math.max(0, this.usedValue - Math.max(0, amount)); }
  addProvider(amount: number): void { this.maxValue += Math.max(0, amount); }

  /**
   * Occupies capacity outright, with no reservation step. A crewed structure claims its slots the
   * moment it comes online, and unlike an Agent it can push `used` past `max`: the plant is
   * already standing when it starts drawing crew, so the colony goes over its cap and cannot
   * produce again until it raises one. Refusing the claim instead would leave a built structure
   * running for free.
   */
  occupyUsed(amount: number): void { this.usedValue += Math.max(0, amount); }
  removeProvider(amount: number): void { this.maxValue = Math.max(0, this.maxValue - Math.max(0, amount)); }
}
