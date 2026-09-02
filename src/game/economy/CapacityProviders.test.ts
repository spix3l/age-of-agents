import { describe, expect, it } from 'vitest';
import { createBuildingSite } from '../entities/buildings/Building';
import { entityId } from '../types/ids';
import { Capacity } from './Capacity';
import { activateCapacityProvider, deactivateCapacityProvider } from './CapacityProviders';

describe('Relay capacity lifecycle', () => {
  it('applies capacity only after completion and removes it on destruction without deleting used units', () => {
    const relay = createBuildingSite(entityId('capacity-relay'), 'relay', 'player', { x: 2, z: 2 }, entityId('capacity-builder'));
    const capacity = new Capacity(8, 7);
    expect(activateCapacityProvider(relay, capacity)).toBe(false);
    relay.operational = true;
    expect(activateCapacityProvider(relay, capacity)).toBe(true);
    expect(capacity.snapshot().max).toBe(13);
    relay.alive = false;
    expect(deactivateCapacityProvider(relay, capacity)).toBe(true);
    expect(capacity.snapshot()).toEqual({ used: 7, reserved: 0, max: 8 });
  });
});
