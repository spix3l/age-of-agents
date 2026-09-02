import { describe, expect, it, vi } from 'vitest';
import { createCore } from '../entities/buildings/Core';
import { createUnitEntity } from '../scenarios/economy';
import { entityId } from '../types/ids';
import { DamageService } from './DamageService';
import { MatchStats } from './MatchStats';

function striker(id: string, team: 'player' | 'enemy') {
  return createUnitEntity(id, 'striker', team, { x: 0, z: 0 });
}

describe('DamageService', () => {
  it('rejects friendly fire, neutral victims, and non-positive amounts', () => {
    const damage = new DamageService();
    const attacker = striker('attacker-1', 'player');
    const ally = striker('ally-1', 'player');
    expect(damage.apply(attacker, ally, 10)).toEqual({ ok: false, reason: 'FRIENDLY_FIRE' });
    expect(ally.hp).toBe(ally.maxHp);
    expect(damage.apply(attacker, striker('enemy-1', 'enemy'), 0)).toEqual({ ok: false, reason: 'INVALID_AMOUNT' });
    expect(damage.apply({ team: 'neutral' }, striker('enemy-2', 'enemy'), 5)).toEqual({ ok: false, reason: 'FRIENDLY_FIRE' });
  });

  it('clamps HP to zero and reports applied damage without overkill', () => {
    const damage = new DamageService();
    const attacker = striker('attacker-2', 'player');
    const victim = striker('victim-1', 'enemy');
    expect(damage.apply(attacker, victim, 20)).toEqual({ ok: true, applied: 20, lethal: false });
    expect(victim.hp).toBe(100);
    expect(damage.apply(attacker, victim, 500)).toEqual({ ok: true, applied: 100, lethal: true });
    expect(victim.hp).toBe(0);
    expect(damage.apply(attacker, victim, 10)).toEqual({ ok: false, reason: 'DEAD_TARGET' });
  });

  it('queues each death once and processes it after system iteration', () => {
    const damage = new DamageService();
    const attacker = striker('attacker-4', 'player');
    const victim = striker('victim-2', 'enemy');
    damage.apply(attacker, victim, 500);
    damage.apply(attacker, victim, 500);
    expect(damage.pendingDeaths).toBe(1);
    const handler = vi.fn();
    expect(damage.processDeaths(handler)).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
    expect(damage.processDeaths(handler)).toBe(0);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('attributes unit and building kills and losses to both teams', () => {
    const stats = new MatchStats();
    const damage = new DamageService(stats);
    const attacker = striker('attacker-5', 'player');
    damage.apply(attacker, striker('victim-3', 'enemy'), 500);
    damage.apply(attacker, createCore(entityId('enemy-core-1'), 'enemy', { x: 5, z: 5 }), 5000);
    damage.processDeaths(() => undefined);
    expect(stats.snapshot('player')).toMatchObject({ unitsKilled: 1, buildingsDestroyed: 1, unitsLost: 0 });
    expect(stats.snapshot('enemy')).toMatchObject({ unitsLost: 1, buildingsLost: 1, unitsKilled: 0 });
    expect(stats.snapshot('player').damageDealt).toBe(120 + 1500);
  });
});
