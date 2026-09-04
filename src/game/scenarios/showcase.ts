import { STARTING_ECONOMY, RESOURCES } from '../../data/resources';
import { BUILDINGS } from '../../data/buildings';
import { createCore } from '../entities/buildings/Core';
import { createBuildingSite } from '../entities/buildings/Building';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { entityId, type BuildingTypeId } from '../types/ids';
import { START_POSITIONS } from '../world/map';
import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';
import { createUnitEntity, type EconomyScenario } from './economy';

/**
 * Art-review fixture (`?scenario=showcase`): one finished player colony with every structure
 * and every Agent kind laid out around the Core, so the whole visual set can be judged in a
 * single screen. Not a balanced start; the opponent is a lone Core.
 */
export function createShowcaseScenario(seed = 20_260_903): EconomyScenario {
  const origin = START_POSITIONS.player;
  const at = (dx: number, dz: number): Vec2 => ({ x: origin.x + dx, z: origin.z + dz });
  let counter = 0;
  const completed = (kind: Exclude<BuildingTypeId, 'core'>, dx: number, dz: number, rotated = false): BuildingEntity => {
    counter += 1;
    const site = createBuildingSite(entityId(`showcase-${kind}-${counter}`), kind, 'player', at(dx, dz), entityId('showcase-builder'), rotated);
    site.operational = true;
    site.constructionProgress = 1;
    site.hp = BUILDINGS[kind].maxHp;
    site.builderId = null;
    site.capacityApplied = true;
    return site;
  };

  // Negative Z is up the screen: the colony fans away from the HUD at the bottom.
  const buildings: BuildingEntity[] = [
    createCore(entityId('player-core'), 'player', origin),
    createCore(entityId('enemy-core'), 'enemy', START_POSITIONS.enemy),
    completed('fabricator', 10, 1),
    completed('foundry', 19, 1),
    completed('relay', 10, -6),
    completed('depot', 5, -6),
    completed('outpost', 16, -7),
    completed('habitat', -4, -8),
    completed('habitat', -8, -8),
    completed('habitat', -12, -8),
    completed('turret', 4, -11),
    completed('turret', 14, -11),
  ];
  for (const dx of [-4, 0, 4, 12, 16, 20]) buildings.push(completed('wall', dx, -14));
  buildings.push(completed('gate', 7, -14));
  for (const dz of [-12, -8]) buildings.push(completed('wall', 23, dz, true));

  const units: UnitEntity[] = [
    createUnitEntity('showcase-worker-1', 'worker', 'player', at(2, 3)),
    createUnitEntity('showcase-worker-2', 'worker', 'player', at(3.5, 3.5)),
    createUnitEntity('showcase-worker-3', 'worker', 'player', at(5, 3)),
    createUnitEntity('showcase-striker-1', 'striker', 'player', at(-4, 3)),
    createUnitEntity('showcase-striker-2', 'striker', 'player', at(-5.5, 3)),
    createUnitEntity('showcase-striker-3', 'striker', 'player', at(-4, 4.5)),
    createUnitEntity('showcase-striker-4', 'striker', 'player', at(-5.5, 4.5)),
    createUnitEntity('showcase-ranger-1', 'ranger', 'player', at(-7.5, 2)),
    createUnitEntity('showcase-scout-1', 'scout', 'player', at(-8, -3)),
    createUnitEntity('showcase-titan-1', 'titan', 'player', at(-6, 7)),
  ];
  const resources = [
    createResourceNode(entityId('showcase-matter'), 'matter', at(-15, 3), RESOURCES.matter.capacity),
    createResourceNode(entityId('showcase-energy'), 'energy', at(-15, -3), RESOURCES.energy.capacity),
    createResourceNode(entityId('showcase-data'), 'data', at(-12, 7), RESOURCES.data.capacity),
  ];
  return { seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}
