import { describe, expect, it } from 'vitest';
import { createBattleScenario } from '../scenarios/battle';
import { createUnitEntity } from '../scenarios/economy';
import { WorldScene } from './WorldScene';

describe('battle presentation', () => {
  it('returns to its baseline scene-object and selectable count after repeated battles', () => {
    const world = new WorldScene();
    const baselineChildren = world.scene.children.length;
    const baselineSelectable = world.selectableMeshes.length;

    for (let round = 0; round < 3; round += 1) {
      const units = Array.from({ length: 40 }, (_, index) => createUnitEntity(
        `round-${round}-unit-${index}`, index % 2 === 0 ? 'striker' : 'worker',
        index % 2 === 0 ? 'player' : 'enemy', { x: index * 0.5 - 10, z: round * 2 },
      ));
      const pooledBefore = world.effectCounters.pooled;
      units.forEach((unit) => world.addUnit(unit));
      expect(world.scene.children.length).toBe(baselineChildren + pooledBefore + 40);
      units.forEach((unit) => {
        world.showShot(unit.position, { x: 0, z: 0 }, unit.team);
        world.showDestruction(unit.position, unit.team);
        world.removeUnit(unit.id);
      });
      world.updatePresentation(2, world.ground);
      expect(world.scene.children.length).toBe(baselineChildren + world.effectCounters.pooled);
      expect(world.selectableMeshes.length).toBe(baselineSelectable);
      expect(world.effectCounters.active).toBe(0);
    }

    // Pooled effect objects are reused across rounds instead of accumulating.
    expect(world.effectCounters.created).toBeLessThanOrEqual(world.effectCounters.pooled);
  });

  it('adds and removes buildings without leaking selectable meshes', () => {
    const world = new WorldScene();
    const baselineSelectable = world.selectableMeshes.length;
    const scenario = createBattleScenario();
    scenario.buildings.forEach((building) => world.addBuilding(building));
    expect(world.selectableMeshes.length).toBeGreaterThan(baselineSelectable);
    scenario.buildings.forEach((building) => world.removeBuilding(building.id));
    expect(world.selectableMeshes.length).toBe(baselineSelectable);
    world.dispose();
    expect(world.scene.children.length).toBe(0);
  });
});
