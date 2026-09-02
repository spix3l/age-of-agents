import { describe, expect, it, vi } from 'vitest';
import { UNITS } from '../../data/units';
import { issueAttackCommand } from '../commands/AttackCommand';
import { issueMoveCommand } from '../commands/MoveCommand';
import { DamageService } from '../combat/DamageService';
import { createCore } from '../entities/buildings/Core';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createUnitEntity } from '../scenarios/economy';
import { SpatialHash } from '../spatial/SpatialHash';
import { entityId, type EntityId } from '../types/ids';
import type { CombatTarget, UnitEntity } from '../types/simulation';
import { CombatSystem } from './CombatSystem';
import { MovementSystem } from './MovementSystem';

const STEP = 1 / 30;

function arena(units: UnitEntity[], buildings: CombatTarget[] = []) {
  const grid = new NavigationGrid(-40, -40, 40, 40);
  const targets = new SpatialHash<CombatTarget>(8);
  const damage = new DamageService();
  const registry = new Map<EntityId, CombatTarget>();
  for (const entity of [...units, ...buildings]) registry.set(entity.id, entity);
  const onShot = vi.fn();
  const combat = new CombatSystem({ targets, lookup: (id) => registry.get(id), damage, grid, onShot });
  const movement = new MovementSystem(grid);
  const step = (steps = 1): void => {
    for (let index = 0; index < steps; index += 1) {
      const alive = [...registry.values()].filter((entity) => entity.alive);
      movement.update(alive.filter((entity): entity is UnitEntity => 'movementSpeed' in entity), STEP);
      targets.sync(alive);
      combat.update(alive.filter((entity): entity is UnitEntity => 'movementSpeed' in entity), STEP);
      damage.processDeaths(({ entity }) => {
        entity.alive = false;
        targets.remove(entity.id);
        registry.delete(entity.id);
      });
    }
  };
  return { grid, targets, damage, combat, movement, step, onShot };
}

describe('CombatSystem', () => {
  it('resolves an ordered duel: pursue, stop in range, and fire on a simulation-time cooldown', () => {
    const attacker = createUnitEntity('duel-attacker', 'striker', 'player', { x: -10, z: 0 });
    const defender = createUnitEntity('duel-defender', 'worker', 'enemy', { x: 10, z: 0 });
    const world = arena([attacker, defender]);
    expect(issueAttackCommand([attacker], defender, world.grid).issued).toBe(1);
    expect(attacker.destination).not.toBeNull();

    world.step(200);
    expect(attacker.activity).toBe('Attacking');
    expect(attacker.destination).toBeNull();
    expect(defender.hp).toBeLessThan(defender.maxHp);

    // Attacks obey the configured cooldown rather than firing on every step.
    world.onShot.mockClear();
    world.step(60);
    expect(world.onShot.mock.calls.length).toBeLessThanOrEqual(Math.ceil(2 / UNITS.striker.attackCooldown));

    world.step(600);
    expect(defender.alive).toBe(false);
    expect(attacker.combat.targetId).toBeNull();
  });

  it('lets an idle Striker auto-acquire, but never a moving unit or a Worker', () => {
    const striker = createUnitEntity('auto-striker', 'striker', 'player', { x: 0, z: 0 });
    const worker = createUnitEntity('auto-worker', 'worker', 'player', { x: 0, z: 3 });
    const foe = createUnitEntity('auto-foe', 'striker', 'enemy', { x: 6, z: 0 });
    const world = arena([striker, worker, foe]);
    world.step(2);
    expect(striker.combat.targetId).toBe(foe.id);
    expect(worker.combat.targetId).toBeNull();

    const mover = createUnitEntity('moving-striker', 'striker', 'player', { x: -20, z: 0 });
    const bystander = createUnitEntity('moving-foe', 'striker', 'enemy', { x: -14, z: 0 });
    const second = arena([mover, bystander]);
    issueMoveCommand([mover], { x: -20, z: 20 }, second.grid);
    second.step(1);
    expect(mover.combat.targetId).toBeNull();
  });

  it('acquires at most five times per simulation second', () => {
    const striker = createUnitEntity('rate-striker', 'striker', 'player', { x: 0, z: 0 });
    const world = arena([striker]);
    world.targets.resetCounters();
    world.step(30);
    expect(world.targets.counters().queries).toBeLessThanOrEqual(6);
  });

  it('retargets a nearby hostile when the ordered target is destroyed', () => {
    const attacker = createUnitEntity('retarget-attacker', 'striker', 'player', { x: 0, z: 0 });
    const first = createUnitEntity('retarget-first', 'worker', 'enemy', { x: 2.5, z: 0 });
    const second = createUnitEntity('retarget-second', 'worker', 'enemy', { x: 5, z: 0 });
    const world = arena([attacker, first, second]);
    issueAttackCommand([attacker], first, world.grid);
    world.step(600);
    expect(first.alive).toBe(false);
    expect(second.alive).toBe(false);
    expect(attacker.alive).toBe(true);
  });

  it('drops a target that leaves the registry without stalling the attacker', () => {
    const attacker = createUnitEntity('ghost-attacker', 'striker', 'player', { x: 0, z: 0 });
    const ghost = createUnitEntity('ghost-target', 'striker', 'enemy', { x: 3, z: 0 });
    const world = arena([attacker, ghost]);
    issueAttackCommand([attacker], ghost, world.grid);
    ghost.alive = false;
    world.step(3);
    expect(attacker.combat.targetId).toBeNull();
    expect(attacker.combat.ordered).toBe(false);
  });

  it('lets a group of Strikers destroy a Core', () => {
    const core = createCore(entityId('target-core'), 'enemy', { x: 12, z: 0 });
    const squad = Array.from({ length: 6 }, (_, index) => createUnitEntity(`squad-${index}`, 'striker', 'player', { x: -2, z: index * 1.6 - 4 }));
    const world = arena(squad, [core]);
    expect(issueAttackCommand(squad, core, world.grid).issued).toBe(6);
    world.step(3000);
    expect(core.alive).toBe(false);
    expect(squad.every((unit) => unit.alive)).toBe(true);
  });

  it('never damages a friendly target even when explicitly ordered', () => {
    const attacker = createUnitEntity('loyal-striker', 'striker', 'player', { x: 0, z: 0 });
    const ally = createUnitEntity('loyal-ally', 'striker', 'player', { x: 2, z: 0 });
    const world = arena([attacker, ally]);
    expect(issueAttackCommand([attacker], ally, world.grid)).toEqual({ issued: 0, rejected: 1 });
    world.step(120);
    expect(ally.hp).toBe(ally.maxHp);
  });
});
