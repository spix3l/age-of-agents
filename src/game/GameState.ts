import { EntityRegistry } from './entities/core/EntityRegistry';
import type { ResourceNodeEntity } from './entities/resources/ResourceNode';
import { Capacity } from './economy/Capacity';
import { EconomyLedger } from './economy/EconomyLedger';
import type { BuildingEntity, Team, UnitEntity } from './types/simulation';

export interface FactionEconomy { readonly ledger: EconomyLedger; readonly capacity: Capacity }

export class GameState {
  readonly units = new EntityRegistry<UnitEntity>();
  readonly buildings = new EntityRegistry<BuildingEntity>();
  readonly resources = new EntityRegistry<ResourceNodeEntity>();
  readonly economies = new Map<Exclude<Team, 'neutral'>, FactionEconomy>();
  elapsedSeconds = 0;

  reset(): void {
    this.units.clear();
    this.buildings.clear();
    this.resources.clear();
    this.economies.clear();
    this.elapsedSeconds = 0;
  }
}
