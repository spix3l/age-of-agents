import { describe, expect, it } from 'vitest';
import { setBuildingOccupancy } from '../navigation/occupancy';
import { Capacity } from '../economy/Capacity';
import { EconomyLedger } from '../economy/EconomyLedger';
import { createBuildingSite } from '../entities/buildings/Building';
import { createCore } from '../entities/buildings/Core';
import { GameState } from '../GameState';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createUnitEntity, createWorkerEntity } from '../scenarios/economy';
import { ProductionSystem } from '../systems/ProductionSystem';
import { entityId } from '../types/ids';
import { destroyEntity } from './destruction';

function world() {
  const state = new GameState();
  const navigation = new NavigationGrid(-40, -30, 40, 30);
  state.economies.set('player', { ledger: new EconomyLedger({ matter: 500, energy: 500 }), capacity: new Capacity(13, 0) });
  state.economies.set('enemy', { ledger: new EconomyLedger({ matter: 500, energy: 500 }), capacity: new Capacity(8, 0) });
  return { state, navigation };
}

describe('destruction lifecycle', () => {
  it('releases used capacity, selection, and orders when a unit dies', () => {
    const context = world();
    const capacity = context.state.economies.get('player')!.capacity;
    const worker = createWorkerEntity('doomed-worker', 'player', { x: 0, z: 0 });
    const witness = createUnitEntity('witness-striker', 'striker', 'enemy', { x: 2, z: 0 });
    const site = createBuildingSite(entityId('doomed-site'), 'relay', 'player', { x: 6, z: 0 }, worker.id);
    context.state.units.add(worker);
    context.state.units.add(witness);
    context.state.buildings.add(site);
    capacity.reserve(1); capacity.commit(1);
    worker.selected = true;
    worker.buildOrder = { buildingId: site.id };
    witness.combat.targetId = worker.id;
    witness.combat.ordered = true;

    expect(destroyEntity(worker, context)).toBe(true);
    expect(context.state.units.get(worker.id)).toBeUndefined();
    expect(worker.alive).toBe(false);
    expect(worker.selected).toBe(false);
    expect(capacity.snapshot().used).toBe(0);
    expect(site.builderId).toBeNull();
    expect(witness.combat.targetId).toBeNull();
    expect(witness.combat.ordered).toBe(false);
    expect(destroyEntity(worker, context)).toBe(false);
  });

  it('frees occupancy, capacity contribution, and queue reservations when a building dies', () => {
    const context = world();
    const economy = context.state.economies.get('player')!;
    const relay = createBuildingSite(entityId('live-relay'), 'relay', 'player', { x: 10, z: 4 }, entityId('builder-1'));
    relay.operational = true;
    relay.constructionProgress = 1;
    relay.hp = relay.maxHp;
    const fabricator = createBuildingSite(entityId('live-fabricator'), 'fabricator', 'player', { x: -10, z: 4 }, entityId('builder-2'));
    fabricator.operational = true;
    context.state.buildings.add(relay);
    context.state.buildings.add(fabricator);
    setBuildingOccupancy(context.navigation, relay, true);
    economy.capacity.addProvider(relay.capacityContribution);
    relay.capacityApplied = true;
    const production = new ProductionSystem();
    expect(production.enqueue(fabricator, 'striker', economy.ledger, economy.capacity).ok).toBe(true);
    expect(economy.capacity.snapshot()).toMatchObject({ max: 18, reserved: 1 });

    expect(destroyEntity(relay, context)).toBe(true);
    expect(context.navigation.isWalkable(context.navigation.worldToCell(relay.position))).toBe(true);
    expect(economy.capacity.snapshot().max).toBe(13);

    expect(destroyEntity(fabricator, context)).toBe(true);
    expect(fabricator.productionQueue).toHaveLength(0);
    expect(economy.capacity.snapshot().reserved).toBe(0);
  });

  it('clears builder orders that pointed at a destroyed construction site', () => {
    const context = world();
    const worker = createWorkerEntity('site-builder', 'player', { x: 0, z: 0 });
    const site = createBuildingSite(entityId('bombed-site'), 'fabricator', 'player', { x: 8, z: 0 }, worker.id);
    context.state.units.add(worker);
    context.state.buildings.add(site);
    worker.buildOrder = { buildingId: site.id };
    worker.activity = 'Building';

    destroyEntity(site, context);

    expect(worker.buildOrder).toBeNull();
    expect(worker.activity).toBe('Idle');
    expect(worker.alive).toBe(true);
  });

  it('never deletes units when a capacity provider is lost', () => {
    const context = world();
    const economy = context.state.economies.get('player')!;
    const relay = createBuildingSite(entityId('over-cap-relay'), 'relay', 'player', { x: 12, z: 8 }, entityId('builder-3'));
    relay.operational = true;
    relay.capacityApplied = true;
    context.state.buildings.add(relay);
    economy.capacity.addProvider(5);
    for (let index = 0; index < 12; index += 1) {
      const unit = createUnitEntity(`over-cap-${index}`, 'worker', 'player', { x: index, z: 0 });
      context.state.units.add(unit);
      economy.capacity.reserve(1);
      economy.capacity.commit(1);
    }

    destroyEntity(relay, context);

    expect(context.state.units.alive()).toHaveLength(12);
    expect(economy.capacity.snapshot().used).toBe(12);
    expect(economy.capacity.snapshot().max).toBe(13);
  });

  it('leaves the enemy Core intact when a player Core dies', () => {
    const context = world();
    const playerCore = createCore(entityId('player-core'), 'player', { x: -20, z: 0 });
    const enemyCore = createCore(entityId('enemy-core'), 'enemy', { x: 20, z: 0 });
    context.state.buildings.add(playerCore);
    context.state.buildings.add(enemyCore);
    destroyEntity(playerCore, context);
    expect(context.state.buildings.alive()).toEqual([enemyCore]);
  });
});
