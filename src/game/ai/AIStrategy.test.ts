import { describe, expect, it } from 'vitest';
import { AI } from '../../data/ai';
import { decideState, scoreStates, type AISnapshot, type AIState } from './AIStrategy';

function snapshot(overrides: Partial<AISnapshot> = {}): AISnapshot {
  return {
    elapsedSeconds: 60, phase: 'early', matter: 100, energy: 50,
    capacityUsed: 4, capacityReserved: 0, capacityMax: 13,
    workers: 5, idleWorkers: 0, army: 0, hasCore: true,
    fabricators: 0, relays: 1, constructionSites: 0,
    threatsNearBase: 0, enemyCoreKnown: false, scoutActive: false, secondsSinceScout: 0,
    armyLostRecently: 0, peakArmy: 0, recoveringUntil: 0, reinforceStalledSeconds: 0, productionQueued: 0,
    ...overrides,
  };
}

describe('AI strategy', () => {
  it('declares all seven strategic states, with TECH reserved until Generations ship', () => {
    const states = Object.keys(scoreStates(snapshot())) as AIState[];
    expect(states.sort()).toEqual(['ATTACK', 'BUILD_ARMY', 'DEFEND', 'EXPAND_ECONOMY', 'RECOVER', 'SCOUT', 'TECH']);
    expect(scoreStates(snapshot()).TECH).toBe(0);
  });

  it('expands the economy by default and grows that preference with the Worker deficit', () => {
    expect(decideState(snapshot()).state).toBe('EXPAND_ECONOMY');
    const hungry = scoreStates(snapshot({ workers: 1 })).EXPAND_ECONOMY;
    const satisfied = scoreStates(snapshot({ workers: 12 })).EXPAND_ECONOMY;
    expect(hungry).toBeGreaterThan(satisfied);
  });

  it('scouts only while the enemy Core is unknown and no scout is already out', () => {
    const ready = snapshot({ secondsSinceScout: AI.scoutInterval, army: 2 });
    expect(decideState(ready).state).toBe('SCOUT');
    expect(decideState({ ...ready, scoutActive: true }).state).not.toBe('SCOUT');
    expect(decideState({ ...ready, enemyCoreKnown: true }).state).not.toBe('SCOUT');
  });

  it('builds an army once a Fabricator exists and attacks only with a known Core and enough force', () => {
    const building = snapshot({ fabricators: 1, army: 2, secondsSinceScout: 0, enemyCoreKnown: true });
    expect(decideState(building).state).toBe('BUILD_ARMY');
    expect(decideState({ ...building, army: AI.attackForce }).state).toBe('ATTACK');
    // Force alone is never enough: the Core has to have been observed.
    expect(decideState({ ...building, army: AI.attackForce, enemyCoreKnown: false }).state).not.toBe('ATTACK');
  });

  it('commits a smaller force rather than deadlocking when it can no longer reinforce', () => {
    const stalled = snapshot({ enemyCoreKnown: true, fabricators: 1, army: AI.minimumAssault, reinforceStalledSeconds: AI.reinforceStallSeconds });
    expect(decideState(stalled).state).toBe('ATTACK');
    expect(decideState({ ...stalled, productionQueued: 1 }).state).not.toBe('ATTACK');
    expect(decideState({ ...stalled, army: AI.minimumAssault - 1 }).state).not.toBe('ATTACK');
    // A brief cash shortage is not a stall.
    expect(decideState({ ...stalled, reinforceStalledSeconds: AI.reinforceStallSeconds - 1 }).state).not.toBe('ATTACK');
  });

  it('prioritises defence over every other state', () => {
    const besieged = snapshot({ threatsNearBase: 3, army: AI.attackForce, enemyCoreKnown: true, fabricators: 1 });
    expect(decideState(besieged).state).toBe('DEFEND');
    expect(scoreStates(besieged).DEFEND).toBeGreaterThan(scoreStates(besieged).ATTACK);
  });

  it('recovers after heavy losses and stays in RECOVER until the timer expires', () => {
    const mauled = snapshot({ peakArmy: 8, armyLostRecently: 6, army: 2, fabricators: 1, enemyCoreKnown: true });
    expect(decideState(mauled).state).toBe('RECOVER');
    const timed = snapshot({ elapsedSeconds: 100, recoveringUntil: 130, fabricators: 1, army: AI.attackForce, enemyCoreKnown: true });
    expect(decideState(timed).state).toBe('RECOVER');
    expect(decideState({ ...timed, elapsedSeconds: 131 }).state).toBe('ATTACK');
  });

  it('is a pure function of the snapshot', () => {
    const input = snapshot({ army: 3, fabricators: 1 });
    const first = decideState(input);
    const second = decideState({ ...input });
    expect(second.state).toBe(first.state);
    expect(second.scores).toEqual(first.scores);
    expect(first.reason).toBeTruthy();
  });
});
