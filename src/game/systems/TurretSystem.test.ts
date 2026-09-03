import { describe, expect, it, vi } from 'vitest';
import { DamageService } from '../combat/DamageService';
import { createBuildingSite } from '../entities/buildings/Building';
import { createUnitEntity } from '../scenarios/economy';
import { SpatialHash } from '../spatial/SpatialHash';
import { entityId } from '../types/ids';
import type { CombatTarget } from '../types/simulation';
import { TurretSystem } from './TurretSystem';

describe('automatic turret defense', () => {
  it('acquires a nearby hostile and fires at a bounded cooldown', () => {
    const turret = createBuildingSite(entityId('test-turret'), 'turret', 'player', { x: 10, z: 10 }, entityId('builder'));
    turret.operational = true;
    const enemy = createUnitEntity('enemy-near-turret', 'striker', 'enemy', { x: 14, z: 10 });
    const targets = new SpatialHash<CombatTarget>();
    targets.sync([turret, enemy]);
    const lookup = (id: CombatTarget['id']) => id === turret.id ? turret : id === enemy.id ? enemy : undefined;
    const shot = vi.fn();
    const system = new TurretSystem({ targets, lookup, damage: new DamageService(), onShot: shot });

    system.update([turret], 1 / 30);
    const afterFirst = enemy.hp;
    system.update([turret], 0.2);
    expect(afterFirst).toBe(enemy.maxHp - turret.combat!.damage);
    expect(enemy.hp).toBe(afterFirst);
    expect(turret.combat!.targetId).toBe(enemy.id);
    expect(shot).toHaveBeenCalledOnce();
  });

  it('drops a hostile that leaves its range and acquires another one still inside it', () => {
    const turret = createBuildingSite(entityId('test-turret-2'), 'turret', 'player', { x: 10, z: 10 }, entityId('builder'));
    turret.operational = true;
    const runner = createUnitEntity('enemy-runner', 'striker', 'enemy', { x: 12, z: 10 });
    const stayer = createUnitEntity('enemy-stayer', 'striker', 'enemy', { x: 10, z: 15 });
    const targets = new SpatialHash<CombatTarget>();
    const lookup = (id: CombatTarget['id']) => [turret, runner, stayer].find((entity) => entity.id === id);
    const system = new TurretSystem({ targets, lookup, damage: new DamageService() });

    targets.sync([turret, runner, stayer]);
    system.update([turret], 1 / 30);
    expect(turret.combat!.targetId).toBe(runner.id);

    runner.position = { x: 60, z: 60 };
    targets.sync([turret, runner, stayer]);
    turret.combat!.cooldown = 0;
    system.update([turret], 1 / 30);
    expect(turret.combat!.targetId).toBe(stayer.id);
    expect(stayer.hp).toBeLessThan(stayer.maxHp);
  });
});
