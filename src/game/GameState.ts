import { EntityRegistry } from './entities/core/EntityRegistry';
import type { UnitEntity } from './types/simulation';

export class GameState {
  readonly units = new EntityRegistry<UnitEntity>();
  elapsedSeconds = 0;

  reset(): void {
    this.units.clear();
    this.elapsedSeconds = 0;
  }
}
