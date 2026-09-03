import type { HarvestableResourceType, UnitEntity } from '../types/simulation';

export function automateWorkers(workers: readonly UnitEntity[], resourceType: HarvestableResourceType): number {
  let changed = 0;
  for (const worker of workers) {
    if (!worker.alive || worker.kind !== 'worker') continue;
    worker.automation = { resourceType, searchCooldown: 0 };
    worker.gatherOrder = null;
    worker.buildOrder = null;
    worker.activity = resourceType === 'matter' ? 'Automating Matter' : resourceType === 'energy' ? 'Automating Energy' : 'Automating Data';
    changed += 1;
  }
  return changed;
}
