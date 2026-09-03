import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceCache, paletteFor } from './palette';
import { buildUnitModel } from './units';
import { buildBuildingModel, buildConstructionScaffold } from './buildings';
import { buildResourceModel } from './resources';

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((object) => { if (object instanceof THREE.Mesh) found.push(object); });
  return found;
}

describe('procedural models', () => {
  it('shares geometry and materials between Agents of the same kind and team', () => {
    const cache = new ResourceCache();
    const first = buildUnitModel(cache, 'striker', 'player', 'a-1');
    const second = buildUnitModel(cache, 'striker', 'player', 'a-2');
    const firstHull = meshes(first.group)[0]!;
    const secondHull = meshes(second.group)[0]!;
    expect(secondHull.geometry).toBe(firstHull.geometry);
    expect(secondHull.material).toBe(firstHull.material);

    // Different factions must not share painted plating, or team colour would leak.
    const enemy = buildUnitModel(cache, 'striker', 'enemy', 'b-1');
    expect(meshes(enemy.group)[0]!.material).not.toBe(firstHull.material);
    cache.dispose();
  });

  it('gives every unit kind the parts the renderer animates', () => {
    const cache = new ResourceCache();
    const worker = buildUnitModel(cache, 'worker', 'player', 'w-1');
    expect(worker.legs.length).toBe(2);
    expect(worker.cargo).not.toBeNull();
    expect(worker.barrel).toBeNull();

    const striker = buildUnitModel(cache, 'striker', 'enemy', 's-1');
    expect(striker.legs.length).toBe(2);
    expect(striker.turret).not.toBeNull();
    expect(striker.barrel).not.toBeNull();

    const ranger = buildUnitModel(cache, 'ranger', 'player', 'r-1');
    const scout = buildUnitModel(cache, 'scout', 'player', 'd-1');
    const titan = buildUnitModel(cache, 'titan', 'player', 't-1');
    expect(ranger.barrel).not.toBeNull();
    expect(scout.hover).not.toBeNull();
    expect(titan.legs).toHaveLength(4);
    expect(titan.barrel).not.toBeNull();
    cache.dispose();
  });

  it('tags every pickable mesh with its entity id so selection still works', () => {
    const cache = new ResourceCache();
    for (const [index, kind] of (['worker', 'striker', 'ranger', 'scout', 'titan'] as const).entries()) {
      const model = buildUnitModel(cache, kind, 'player', `pick-${index + 1}`);
      expect(model.pickable.length).toBeGreaterThan(0);
      expect(model.pickable.every((mesh) => typeof mesh.userData.entityId === 'string')).toBe(true);
    }
    const core = buildBuildingModel(cache, 'core', 'enemy', 'pick-3');
    expect(core.pickable.every((mesh) => mesh.userData.entityId === 'pick-3')).toBe(true);
    expect(core.spinners.length).toBe(4);
    expect(core.column).not.toBeNull();

    const fabricator = buildBuildingModel(cache, 'fabricator', 'player', 'pick-4');
    expect(fabricator.arm).not.toBeNull();
    for (const kind of ['relay', 'wall', 'outpost', 'turret', 'foundry'] as const) {
      const building = buildBuildingModel(cache, kind, 'player', `building-${kind}`);
      expect(building.pickable.length).toBeGreaterThan(0);
      expect(building.generationParts.length).toBeGreaterThan(0);
    }
    cache.dispose();
  });

  it('builds deposits and scaffolding without leaking cached resources', () => {
    const cache = new ResourceCache();
    const matter = buildResourceModel(cache, 'matter', 'node-1');
    const energy = buildResourceModel(cache, 'energy', 'node-2');
    const data = buildResourceModel(cache, 'data', 'node-3');
    expect(matter.shards.length).toBeGreaterThan(4);
    // Energy adds a halo ring on top of its crystal blades.
    expect(energy.shards.length).toBeGreaterThan(matter.shards.length - 2);
    expect(data.shards.length).toBeGreaterThan(2);
    expect(buildConstructionScaffold(cache, 'fabricator', 'player').children.length).toBe(5);

    cache.dispose();
    expect(paletteFor('player').glow).not.toBe(paletteFor('enemy').glow);
  });
});
