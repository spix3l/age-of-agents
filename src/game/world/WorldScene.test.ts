import { describe, expect, it } from 'vitest';
import { createBattleScenario } from '../scenarios/battle';
import { createUnitEntity } from '../scenarios/economy';
import { WorldScene } from './WorldScene';
import { createResourceNode } from '../entities/resources/ResourceNode';
import { entityId } from '../types/ids';

describe('battle presentation', () => {
  it('runs extraction only at the node, then smoothly returns the tool arm to rest', () => {
    const world = new WorldScene();
    const node = createResourceNode(entityId('mine'), 'matter', { x: 0, z: 0 }, 100);
    const worker = createUnitEntity('miner', 'worker', 'player', { x: 0, z: 3 });
    world.addResource(node); world.addUnit(worker);
    const model = world.scene.getObjectByName('unit-miner')!;
    const beam = model.getObjectByName('harvest-effect')!;
    const arm = model.getObjectByName('tool-arm')!;
    const drill = model.getObjectByName('harvest-drill')!;
    worker.gatherOrder = { resourceId: node.id, resourceType: 'matter', state: 'moving-to-node', workSeconds: 0 };
    world.syncUnits([worker], 1);
    expect(beam.visible).toBe(false);
    worker.gatherOrder.state = 'extracting';
    const initial = drill.quaternion.clone();
    for (let i = 0; i < 30; i++) world.syncUnits([worker], 1);
    expect(beam.visible).toBe(true);
    expect(arm.rotation.x).toBeGreaterThan(0.6);
    expect(drill.quaternion.equals(initial)).toBe(false);
    expect(beam.children[0]!.scale.y).toBeGreaterThan(0.1);
    worker.activity = 'Attacking';
    world.syncUnits([worker], 1);
    expect(beam.visible).toBe(false);
    worker.activity = 'Returning cargo'; worker.gatherOrder.state = 'returning';
    for (let i = 0; i < 60; i++) world.syncUnits([worker], 1);
    expect(arm.rotation.x).toBeCloseTo(0, 3);
    expect(worker.cargo.amount).toBe(0); // Presentation never extracts resources.
    world.dispose();
  });

  it('recoils both Titan weapons briefly and returns them to their original mounting position', () => {
    const world = new WorldScene();
    const titan = createUnitEntity('shooter', 'titan', 'player', { x: 0, z: 0 });
    world.addUnit(titan);
    const weapons: Array<{ position: { z: number } }> = [];
    world.scene.getObjectByName('unit-shooter')!.traverse((o) => { if (o.name === 'weapon') weapons.push(o); });
    expect(weapons).toHaveLength(2);
    world.showShot(titan.position, { x: 0, z: -5 }, titan.team, 1, titan.id);
    world.syncUnits([titan], 1);
    for (const weapon of weapons) {
      expect(weapon.position.z).toBeGreaterThan(-0.3);
      expect(weapon.position.z).toBeLessThan(-0.23);
    }
    for (let i = 0; i < 30; i++) world.syncUnits([titan], 1);
    for (const weapon of weapons) expect(weapon.position.z).toBeCloseTo(-0.3, 3);
    world.dispose();
  });

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
