import { describe, expect, it } from 'vitest';
import { MatchSimulation } from '../match/MatchSimulation';
import { createEconomyScenario } from './economy';

/**
 * Freestyle is the shipping world with nobody in the far corner: the same generated map, the same
 * mirrored deposits, and no opponent to race. Nothing may end the match on its own.
 */
describe('freestyle mode', () => {
  it('lays the map down without an opposing colony', () => {
    const contested = createEconomyScenario(31, false);
    const solo = createEconomyScenario(31, true);

    expect(solo.buildings.some((building) => building.team === 'enemy')).toBe(false);
    expect(solo.units.some((unit) => unit.team === 'enemy')).toBe(false);
    expect(solo.buildings.filter((building) => building.team === 'player')).toHaveLength(1);
    expect(solo.units.filter((unit) => unit.team === 'player').length).toBe(3);
    // The far half of the map is still worth walking to: the deposits are untouched.
    expect(solo.resources.map((node) => node.id)).toEqual(contested.resources.map((node) => node.id));
  });

  it('runs with no opponent and never ends by itself', () => {
    const sim = new MatchSimulation({ seed: 31, solo: true, opponent: false });
    expect(sim.opponent).toBeNull();
    expect(sim.coreOf('enemy')).toBeUndefined();

    sim.economy('player')!.ledger.deposit('matter', 400);
    sim.run(600);

    expect(sim.match.isOver).toBe(false);
    expect(sim.unitsOf('enemy')).toHaveLength(0);
    // The colony is still the player's to grow: workers, Core, and economy all intact.
    expect(sim.coreOf('player')?.alive).toBe(true);
    expect(sim.unitsOf('player').length).toBeGreaterThan(0);
  });
});
