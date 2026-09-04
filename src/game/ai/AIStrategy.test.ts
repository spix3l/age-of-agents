import { describe, expect, it } from 'vitest';
import { AI, resolveTuning } from '../../data/ai';
import { decideState, scoreStates, type AISnapshot, type AIState } from './AIStrategy';

const TUNING = resolveTuning('standard');
const decide = (input: AISnapshot) => decideState(input, TUNING);
const score = (input: AISnapshot) => scoreStates(input, TUNING);

function snapshot(overrides: Partial<AISnapshot> = {}): AISnapshot {
  return {
    // Past the preset's earliest attack time by default, so a case that is *about* the assault
    // rule states it, and a change to the opening's pacing does not silently disarm these.
    elapsedSeconds: TUNING.earliestAttackSeconds + 60, phase: 'mid', matter: 100, energy: 50, data: 0, generation: 1,
    capacityUsed: 4, capacityReserved: 0, capacityMax: 13,
    workers: 5, idleWorkers: 0, army: 0, hasCore: true,
    fabricators: 0, relays: 1, constructionSites: 0,
    threatsNearBase: 0, enemyCoreKnown: false, scoutActive: false, secondsSinceScout: 0,
    armyLostRecently: 0, peakArmy: 0, recoveringUntil: 0, reinforceStalledSeconds: 0, productionQueued: 0,
    assaultsLaunched: 0, secondsSinceAssault: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

describe('AI strategy', () => {
  it('declares all seven strategic states and enters TECH only when an upgrade is affordable', () => {
    const states = Object.keys(score(snapshot())) as AIState[];
    expect(states.sort()).toEqual(['ATTACK', 'BUILD_ARMY', 'DEFEND', 'EXPAND_ECONOMY', 'RECOVER', 'SCOUT', 'TECH']);
    expect(score(snapshot()).TECH).toBe(0);
    expect(score(snapshot({ matter: 180, energy: 100, data: 40 })).TECH).toBeGreaterThan(0);
  });

  it('expands the economy by default and grows that preference with the Worker deficit', () => {
    expect(decide(snapshot()).state).toBe('EXPAND_ECONOMY');
    const hungry = score(snapshot({ workers: 1 })).EXPAND_ECONOMY;
    const satisfied = score(snapshot({ workers: 12 })).EXPAND_ECONOMY;
    expect(hungry).toBeGreaterThan(satisfied);
  });

  it('scouts only while the enemy Core is unknown and no scout is already out', () => {
    const ready = snapshot({ secondsSinceScout: AI.scoutInterval, army: 2 });
    expect(decide(ready).state).toBe('SCOUT');
    expect(decide({ ...ready, scoutActive: true }).state).not.toBe('SCOUT');
    expect(decide({ ...ready, enemyCoreKnown: true }).state).not.toBe('SCOUT');
  });

  it('builds an army once a Fabricator exists and attacks only with a known Core and enough force', () => {
    const building = snapshot({ fabricators: 1, army: 2, secondsSinceScout: 0, enemyCoreKnown: true });
    expect(decide(building).state).toBe('BUILD_ARMY');
    expect(decide({ ...building, army: TUNING.attackForce }).state).toBe('ATTACK');
    // Force alone is never enough: the Core has to have been observed.
    expect(decide({ ...building, army: TUNING.attackForce, enemyCoreKnown: false }).state).not.toBe('ATTACK');
  });

  it('commits a smaller force rather than deadlocking when it can no longer reinforce', () => {
    const stalled = snapshot({ enemyCoreKnown: true, fabricators: 1, army: AI.minimumAssault, reinforceStalledSeconds: AI.reinforceStallSeconds });
    expect(decide(stalled).state).toBe('ATTACK');
    expect(decide({ ...stalled, productionQueued: 1 }).state).not.toBe('ATTACK');
    expect(decide({ ...stalled, army: AI.minimumAssault - 1 }).state).not.toBe('ATTACK');
    // A brief cash shortage is not a stall.
    expect(decide({ ...stalled, reinforceStalledSeconds: AI.reinforceStallSeconds - 1 }).state).not.toBe('ATTACK');
  });

  it('prioritises defence over every other state', () => {
    const besieged = snapshot({ threatsNearBase: 3, army: TUNING.attackForce, enemyCoreKnown: true, fabricators: 1 });
    expect(decide(besieged).state).toBe('DEFEND');
    expect(score(besieged).DEFEND).toBeGreaterThan(score(besieged).ATTACK);
  });

  it('recovers after heavy losses and stays in RECOVER until the timer expires', () => {
    const mauled = snapshot({ peakArmy: 8, armyLostRecently: 6, army: 2, fabricators: 1, enemyCoreKnown: true });
    expect(decide(mauled).state).toBe('RECOVER');
    const recoverUntil = TUNING.earliestAttackSeconds + 130;
    const timed = snapshot({ elapsedSeconds: recoverUntil - 30, recoveringUntil: recoverUntil, fabricators: 1, army: TUNING.attackForce, enemyCoreKnown: true });
    expect(decide(timed).state).toBe('RECOVER');
    expect(decide({ ...timed, elapsedSeconds: recoverUntil + 1 }).state).toBe('ATTACK');
  });

  it('never launches an assault before the difficulty\u2019s earliest attack time', () => {
    const ready = snapshot({ enemyCoreKnown: true, fabricators: 1, army: TUNING.attackForce });
    expect(decide({ ...ready, elapsedSeconds: TUNING.earliestAttackSeconds }).state).toBe('ATTACK');
    expect(decide({ ...ready, elapsedSeconds: TUNING.earliestAttackSeconds - 1 }).state).not.toBe('ATTACK');
  });

  it('is a pure function of the snapshot', () => {
    const input = snapshot({ army: 3, fabricators: 1 });
    const first = decide(input);
    const second = decide({ ...input });
    expect(second.state).toBe(first.state);
    expect(second.scores).toEqual(first.scores);
    expect(first.reason).toBeTruthy();
  });
});
