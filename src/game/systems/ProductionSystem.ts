import { UNITS } from '../../data/units';
import type { BuildingEntity, UnitEntity } from '../types/simulation';
import type { EntityId, UnitTypeId } from '../types/ids';
import type { Capacity } from '../economy/Capacity';
import type { EconomyLedger } from '../economy/EconomyLedger';
import { entityId } from '../types/ids';

export type ProductionRejection = 'NOT_A_PRODUCER' | 'NOT_OPERATIONAL' | 'INSUFFICIENT_RESOURCES' | 'CAPACITY_REACHED' | 'LOCKED';
export type EnqueueResult = { readonly ok: true } | { readonly ok: false; readonly reason: ProductionRejection };

export class ProductionSystem {
  private nextOrder = 1;

  enqueueWorker(core: BuildingEntity, ledger: EconomyLedger, capacity: Capacity): EnqueueResult {
    return this.enqueue(core, 'worker', ledger, capacity);
  }

  enqueue(producer: BuildingEntity, unitType: UnitTypeId, ledger: EconomyLedger, capacity: Capacity): EnqueueResult {
    const allowed = (producer.kind === 'core' && unitType === 'worker')
      || (producer.kind === 'fabricator' && (unitType === 'striker' || unitType === 'ranger' || unitType === 'scout'))
      || (producer.kind === 'foundry' && unitType === 'titan');
    if (!producer.alive || !allowed) return { ok: false, reason: 'NOT_A_PRODUCER' };
    if (!producer.operational) return { ok: false, reason: 'NOT_OPERATIONAL' };
    const config = UNITS[unitType];
    if (!capacity.canReserve(config.capacityCost)) return { ok: false, reason: 'CAPACITY_REACHED' };
    if (!ledger.canAfford(config.cost)) return { ok: false, reason: 'INSUFFICIENT_RESOURCES' };
    capacity.reserve(config.capacityCost);
    ledger.spend(config.cost);
    producer.productionQueue.push({
      id: entityId(`${unitType}-order-${this.nextOrder++}`), unitType, duration: config.productionTime,
      elapsed: 0, capacity: config.capacityCost,
    });
    return { ok: true };
  }

  update(
    buildings: readonly BuildingEntity[],
    delta: number,
    economyFor: (team: BuildingEntity['team']) => { ledger: EconomyLedger; capacity: Capacity } | undefined,
    spawn: (producer: BuildingEntity, unitType: UnitTypeId) => UnitEntity | null,
  ): void {
    for (const core of buildings) {
      const order = core.productionQueue[0];
      if (!core.alive || !core.operational || !order) continue;
      const economy = economyFor(core.team);
      if (!economy) continue;
      order.elapsed += delta;
      if (order.elapsed < order.duration) continue;
      const unit = spawn(core, order.unitType);
      core.productionQueue.shift();
      if (unit) economy.capacity.commit(order.capacity);
      else {
        economy.capacity.cancel(order.capacity);
        economy.ledger.refund(UNITS[order.unitType].cost);
      }
    }
  }

  cancelFront(core: BuildingEntity, ledger: EconomyLedger, capacity: Capacity): boolean {
    const order = core.productionQueue[0];
    return order ? this.cancelOrder(core, order.id, ledger, capacity) : false;
  }

  cancelOrder(producer: BuildingEntity, orderId: EntityId, ledger: EconomyLedger, capacity: Capacity): boolean {
    const index = producer.productionQueue.findIndex((order) => order.id === orderId);
    if (index < 0) return false;
    const [order] = producer.productionQueue.splice(index, 1);
    if (!order) return false;
    capacity.cancel(order.capacity);
    ledger.refund(UNITS[order.unitType].cost);
    return true;
  }

  cancelAll(producer: BuildingEntity, ledger: EconomyLedger, capacity: Capacity): number {
    const orders = [...producer.productionQueue];
    for (const order of orders) this.cancelOrder(producer, order.id, ledger, capacity);
    return orders.length;
  }
}
