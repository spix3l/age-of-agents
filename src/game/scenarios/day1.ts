import { UNITS } from '../../data/units';
import { entityId } from '../types/ids';
import type { UnitEntity } from '../types/simulation';

export function createDay1Units(): UnitEntity[] {
  const config = UNITS.worker;
  return Array.from({ length: 30 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const x = -29 + column * 1.35;
    const z = 8 + row * 1.35;
    return {
      id: entityId(`player-worker-${String(index + 1).padStart(2, '0')}`),
      kind: config.id,
      team: 'player',
      alive: true,
      position: { x, z },
      previousPosition: { x, z },
      hp: config.maxHp,
      maxHp: config.maxHp,
      radius: config.radius,
      movementSpeed: config.movementSpeed,
      path: [],
      pathIndex: 0,
      destination: null,
      stuckSeconds: 0,
      repathCount: 0,
      selected: false,
      activity: 'Idle',
      cargo: { type: null, amount: 0 },
      gatherOrder: null,
      buildOrder: null,
      automation: null,
    };
  });
}
