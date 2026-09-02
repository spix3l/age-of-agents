import { AI, desiredWorkers } from '../../data/ai';
import { UNITS } from '../../data/units';
import type { UnitEntity } from '../types/simulation';
import type { AICommands, AIView } from './AIContext';
import type { AISnapshot, AIState } from './AIStrategy';

/**
 * Keeps income flowing: every free Worker is put on persistent automation, and the Core keeps
 * a Worker queued until the phase target is met. Uses only normal commands, so the AI pays
 * the same resource and capacity costs a player does.
 */
export class EconomyAI {
  update(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    this.assignIdleWorkers(view, commands);
    this.queueWorkers(view, commands, snapshot, state);
  }

  /** Splits free Workers between Matter and Energy using the configured ratio. */
  private assignIdleWorkers(view: AIView, commands: AICommands): void {
    const workers = view.units().filter((unit) => unit.kind === 'worker');
    const free = workers.filter(isFree);
    if (free.length === 0) return;
    const busy = workers.filter((worker) => !isFree(worker));
    let energyWorkers = busy.filter((worker) => automationType(worker) === 'energy').length;
    let matterWorkers = busy.filter((worker) => automationType(worker) === 'matter').length;
    const hasEnergyNode = view.resources().some((node) => node.resourceType === 'energy');

    for (const worker of free) {
      const total = energyWorkers + matterWorkers;
      const wantsEnergy = hasEnergyNode && (energyWorkers) < Math.round((total + 1) * AI.energyWorkerRatio);
      commands.automate([worker], wantsEnergy ? 'energy' : 'matter');
      if (wantsEnergy) energyWorkers += 1; else matterWorkers += 1;
    }
  }

  private queueWorkers(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    const core = view.core();
    if (!core?.operational) return;
    const wanted = desiredWorkers(snapshot.elapsedSeconds);
    const pending = core.productionQueue.filter((order) => order.unitType === 'worker').length;
    if (snapshot.workers + pending >= wanted) return;
    if (core.productionQueue.length >= 2) return;
    // While rebuilding or fighting at home, army production keeps the Fabricator's resources.
    if ((state === 'DEFEND' || state === 'ATTACK') && snapshot.workers >= 4) return;
    const cost = UNITS.worker.cost.matter ?? 0;
    if (view.balances().matter < cost) return;
    commands.produce(core, 'worker');
  }
}

function isFree(worker: UnitEntity): boolean {
  return !worker.automation && !worker.gatherOrder && !worker.buildOrder;
}

function automationType(worker: UnitEntity): 'matter' | 'energy' | null {
  return worker.automation?.resourceType ?? worker.gatherOrder?.resourceType ?? null;
}
