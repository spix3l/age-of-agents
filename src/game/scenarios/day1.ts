import { entityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';
import { createWorkerEntity } from './economy';

export function createDay1Units(): UnitEntity[] {
  return Array.from({ length: 30 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return createWorkerEntity(
      entityId(`player-worker-${String(index + 1).padStart(2, '0')}`),
      'player',
      { x: -29 + column * 1.35, z: 8 + row * 1.35 },
    );
  });
}
