/** Deterministic mulberry32 PRNG. Every AI decision that needs variety must draw from one of these. */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  range(min: number, max: number): number { return min + this.next() * (max - min); }

  integer(minInclusive: number, maxExclusive: number): number {
    return Math.floor(this.range(minInclusive, maxExclusive));
  }

  pick<T>(values: readonly T[]): T | undefined {
    return values.length === 0 ? undefined : values[this.integer(0, values.length)];
  }
}
