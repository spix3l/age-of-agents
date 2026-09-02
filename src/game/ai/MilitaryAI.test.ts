import { describe, expect, it } from 'vitest';
import { AI } from '../../data/ai';
import { MatchSimulation } from '../match/MatchSimulation';
import { createUnitEntity } from '../scenarios/economy';
import { checkInvariants } from '../debug/soak';
import { distance } from './AIKnowledge';

function idleMatch(seed: number) {
  return new MatchSimulation({ seed, scenario: 'economy', opponent: { seed } });
}

describe('AI military', () => {
  it('produces Strikers continuously and keeps them near an assembly point before attacking', () => {
    const simulation = idleMatch(31);
    simulation.run(200);
    const army = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'striker');
    expect(army.length).toBeGreaterThan(0);
    const core = simulation.coreOf('enemy')!;
    const home = army.filter((unit) => distance(unit.position, core.position) < AI.buildRingMax + AI.assemblyRadius + 6);
    expect(home.length).toBeGreaterThan(0);
    expect(checkInvariants(simulation)).toEqual([]);
  });

  it('never attacks the player Core before it has been observed', () => {
    const simulation = idleMatch(32);
    const ai = simulation.opponent!;
    const playerCore = simulation.coreOf('player')!;
    for (let step = 0; step < 30 * 420; step += 1) {
      simulation.step(1 / 30);
      if (!ai.knowledge.hasDiscoveredCore) {
        expect(playerCore.hp).toBe(playerCore.maxHp);
        continue;
      }
      break;
    }
    expect(ai.knowledge.hasDiscoveredCore).toBe(true);
    expect(ai.knowledge.discoveredCore?.id).toBe(playerCore.id);
  });

  it('switches to DEFEND and engages hostiles that reach its base', () => {
    const simulation = idleMatch(33);
    simulation.run(120);
    const core = simulation.coreOf('enemy')!;
    const raiders = Array.from({ length: 3 }, (_, index) => createUnitEntity(
      `player-raider-${index}`, 'striker', 'player', { x: core.position.x + 6, z: core.position.z + index * 1.5 },
    ));
    raiders.forEach((raider) => simulation.state.units.add(raider));
    simulation.run(2);
    expect(simulation.opponent!.state).toBe('DEFEND');
    const engaged = simulation.unitsOf('enemy').some((unit) => unit.combat.targetId !== null);
    expect(engaged).toBe(true);

    // The raid is answered, and the AI leaves DEFEND once its base is clear again.
    simulation.run(120);
    expect(raiders.every((raider) => !raider.alive)).toBe(true);
    expect(simulation.opponent!.state).not.toBe('DEFEND');
  });

  it('keeps a defence reserve at home when it launches an assault', () => {
    const simulation = idleMatch(34);
    for (let step = 0; step < 30 * 600 && simulation.opponent!.state !== 'ATTACK'; step += 1) simulation.step(1 / 30);
    expect(simulation.opponent!.state).toBe('ATTACK');
    const debug = simulation.opponent!.debug;
    const army = simulation.unitsOf('enemy').filter((unit) => unit.kind === 'striker').length;
    expect(debug.assaultSize).toBeGreaterThan(0);
    expect(debug.assaultSize).toBeLessThanOrEqual(Math.max(1, army - AI.defenseReserve));
  });

  it('recovers after its army is wiped out and rebuilds instead of trickling in', () => {
    const simulation = idleMatch(35);
    // Wipe the army as soon as one exists, long before it would launch an assault.
    for (let step = 0; step < 30 * 600 && simulation.opponent!.debug.army < AI.minimumAssault; step += 1) simulation.step(1 / 30);
    expect(simulation.match.isOver).toBe(false);
    const executioner = simulation.unitsOf('player')[0]!;
    for (const striker of simulation.unitsOf('enemy').filter((unit) => unit.kind === 'striker')) {
      simulation.damage.apply(executioner, striker, striker.maxHp * 2);
    }
    simulation.step();
    simulation.run(5);
    expect(simulation.opponent!.state).toBe('RECOVER');
    expect(simulation.opponent!.debug.assaultSize).toBe(0);

    simulation.run(AI.recoverSeconds + 180);
    expect(simulation.unitsOf('enemy').filter((unit) => unit.kind === 'striker').length).toBeGreaterThan(0);
    // Recovery is temporary: the AI returns to normal operation and can attack again.
    expect(simulation.opponent!.state).not.toBe('RECOVER');
    expect(checkInvariants(simulation)).toEqual([]);
  });

  it('clears a remembered target that no longer exists', () => {
    const simulation = idleMatch(36);
    const ai = simulation.opponent!;
    const playerCore = simulation.coreOf('player')!;
    ai.knowledge.remember(playerCore, 10);
    expect(ai.knowledge.hasDiscoveredCore).toBe(true);
    ai.forget(playerCore.id);
    expect(ai.knowledge.hasDiscoveredCore).toBe(false);
  });
});
