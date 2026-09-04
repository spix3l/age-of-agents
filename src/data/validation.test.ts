import { describe, expect, it } from 'vitest';
import { BUILDINGS } from './buildings';
import { UNITS, type UnitConfig } from './units';
import { validateBuildingConfig, validateUnitConfig } from './validation';

describe('balance data validation', () => {
  it('accepts all shipped unit and building configs', () => {
    expect(() => Object.values(UNITS).forEach(validateUnitConfig)).not.toThrow();
    expect(() => Object.values(BUILDINGS).forEach(validateBuildingConfig)).not.toThrow();
  });

  it('rejects a plant that occupies no crew, and a structure that charges crew for nothing', () => {
    expect(() => validateBuildingConfig({ ...BUILDINGS.reclaimer, capacityUse: 0 })).toThrow(/without occupying capacity/);
    expect(() => validateBuildingConfig({ ...BUILDINGS.depot, capacityUse: 2 })).toThrow(/without synthesizing/);
    expect(() => validateBuildingConfig({ ...BUILDINGS.relay, capacityUse: 2 })).toThrow(/both provide and occupy/);
  });

  it('rejects a negative cost', () => {
    const invalid: UnitConfig = { ...UNITS.worker, cost: { matter: -1 } };
    expect(() => validateUnitConfig(invalid)).toThrow(/invalid matter cost/);
  });
});
