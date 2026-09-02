import { UNITS } from '../../data/units';
import type { BuildingEntity, UnitEntity } from '../types/simulation';
import type { Capacity } from '../economy/Capacity';
import type { EconomyLedger } from '../economy/EconomyLedger';
import { entityId } from '../types/ids';

export type ProductionRejection = 'NOT_A_CORE' | 'INSUFFICIENT_MATTER' | 'CAPACITY_REACHED';
export type EnqueueResult = { readonly ok: true } | { readonly ok: false; readonly reason: ProductionRejection };

export class ProductionSystem {
  private nextOrder = 1;

  enqueueWorker(core: BuildingEntity, ledger: EconomyLedger, capacity: Capacity): EnqueueResult {
    if (!core.alive || core.kind !== 'core') return { ok: false, reason: 'NOT_A_CORE' };
    const config = UNITS.worker;
    if (!capacity.canReserve(config.capacityCost)) return { ok: false, reason: 'CAPACITY_REACHED' };
    if (!ledger.canAfford(config.cost)) return { ok: false, reason: 'INSUFFICIENT_MATTER' };
    capacity.reserve(config.capacityCost);
    ledger.spend(config.cost);
    core.productionQueue.push({
      id: entityId(`worker-order-${this.nextOrder++}`), unitType: 'worker', duration: config.productionTime,
      elapsed: 0, capacity: config.capacityCost,
    });
    return { ok: true };
  }

  update(
    buildings: readonly BuildingEntity[],
    delta: number,
    economyFor: (team: BuildingEntity['team']) => { ledger: EconomyLedger; capacity: Capacity } | undefined,
    spawn: (core: BuildingEntity) => UnitEntity | null,
  ): void {
    for (const core of buildings) {
      const order = core.productionQueue[0];
      if (!core.alive || !order) continue;
      const economy = economyFor(core.team);
      if (!economy) continue;
      order.elapsed += delta;
      if (order.elapsed < order.duration) continue;
      const unit = spawn(core);
      core.productionQueue.shift();
      if (unit) economy.capacity.commit(order.capacity);
      else {
        economy.capacity.cancel(order.capacity);
        economy.ledger.refund(UNITS.worker.cost);
      }
    }
  }

  cancelFront(core: BuildingEntity, ledger: EconomyLedger, capacity: Capacity): boolean {
    const order = core.productionQueue.shift();
    if (!order) return false;
    capacity.cancel(order.capacity);
    ledger.refund(UNITS[order.unitType].cost);
    return true;
  }
}
