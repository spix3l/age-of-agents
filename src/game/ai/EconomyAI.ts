import { AI, desiredWorkers, type AITuning } from '../../data/ai';
import { UNITS } from '../../data/units';
import type { EntityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';
import type { AICommands, AIView } from './AIContext';
import type { AISnapshot, AIState } from './AIStrategy';

/**
 * Keeps income flowing: every free Worker is put on persistent automation, and the Core keeps
 * a Worker queued until the phase target is met. Uses only normal commands, so the AI pays
 * the same resource and capacity costs a player does.
 */
export class EconomyAI {
  constructor(private readonly tuning: AITuning) {}

  /** `reserved` holds units another slice is using, such as the current scout. */
  update(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState, reserved: ReadonlySet<EntityId> = new Set()): void {
    this.assignIdleWorkers(view, commands, reserved);
    this.queueWorkers(view, commands, snapshot, state);
  }

  /** Splits free Workers between Matter and Energy using the configured ratio. */
  private assignIdleWorkers(view: AIView, commands: AICommands, reserved: ReadonlySet<EntityId>): void {
    const workers = view.units().filter((unit) => unit.kind === 'worker' && !reserved.has(unit.id));
    const free = workers.filter(isFree);
    const busy = workers.filter((worker) => !isFree(worker));
    let energyWorkers = busy.filter((worker) => automationType(worker) === 'energy').length;
    let matterWorkers = busy.filter((worker) => automationType(worker) === 'matter').length;
    let dataWorkers = busy.filter((worker) => automationType(worker) === 'data').length;
    const hasEnergyNode = view.resources().some((node) => node.resourceType === 'energy');
    const hasDataNode = view.resources().some((node) => node.resourceType === 'data');
    // Almost everything the colony buys is Matter-heavy, so a large surplus of either of the
    // other two is a signal to move gatherers back rather than keep banking what it cannot use.
    const balances = view.balances();
    const energySurplus = balances.energy > balances.matter + AI.surplusMargin;
    // One dedicated archivist funds evolution and the Data-hungry roster without ever
    // starving the Matter line that pays for everything else. The opening cannot afford one:
    // until the colony has a working crew, every trip has to go into Matter and Energy.
    const dataCrew = workers.length >= AI.dataCrewFrom && balances.data < AI.dataTarget ? AI.dataWorkers : 0;

    for (const worker of free) {
      if (hasDataNode && dataWorkers < dataCrew) {
        commands.automate([worker], 'data');
        dataWorkers += 1;
        continue;
      }
      const total = energyWorkers + matterWorkers;
      const wantsEnergy = hasEnergyNode && !energySurplus && energyWorkers < Math.round((total + 1) * AI.energyWorkerRatio);
      commands.automate([worker], wantsEnergy ? 'energy' : 'matter');
      if (wantsEnergy) energyWorkers += 1; else matterWorkers += 1;
    }

    // Automation is persistent, so without this the colony banks Energy it will never spend
    // while its Matter line starves. One gatherer moves per decision, which never thrashes.
    if (energySurplus && energyWorkers > 1) {
      const spare = busy.find((worker) => automationType(worker) === 'energy');
      if (spare) commands.automate([spare], 'matter');
    }
  }

  private queueWorkers(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    const core = view.core();
    if (!core?.operational) return;
    const wanted = desiredWorkers(snapshot.elapsedSeconds, this.tuning);
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

/**
 * A Worker already travelling under an explicit order is busy, not idle.
 *
 * The exception is a Worker holding a bare gather order with no automation behind it: a recalled
 * scout or a cancelled build leaves one outside the colony's standing policy, and now that a
 * gather order survives the deposit it was aimed at, such a Worker would keep mining on its own
 * initiative forever and never be counted in the Matter/Energy split again. Adopting it back is
 * safe mid-trip -- automation only acts once the order it is holding finishes.
 */
function isFree(worker: UnitEntity): boolean {
  if (worker.automation || worker.buildOrder) return false;
  return worker.gatherOrder !== null || !worker.destination;
}

function automationType(worker: UnitEntity): 'matter' | 'energy' | 'data' | null {
  return worker.automation?.resourceType ?? worker.gatherOrder?.resourceType ?? null;
}
