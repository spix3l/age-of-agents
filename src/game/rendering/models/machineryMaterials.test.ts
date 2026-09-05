import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceCache } from './palette';
import { buildBuildingModel } from './buildings';
import { buildUnitModel } from './units';
import { BUILDINGS } from '../../../data/buildings';
import type { BuildingTypeId } from '../../types/ids';

function materials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const found = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) found.add(object.material);
  });
  return [...found];
}

describe('machinery material treatment', () => {
  it('leaves shared base materials untouched and retains faction emitters', () => {
    const cache = new ResourceCache();
    const hull = cache.hull('player');
    const original = { map: hull.map, bumpMap: hull.bumpMap, color: hull.color.getHex() };
    const core = buildBuildingModel(cache, 'core', 'player', 'core');
    const relay = buildBuildingModel(cache, 'relay', 'player', 'relay');
    const coreMaterials = materials(core.group);
    expect(coreMaterials.some((m) => m.name === 'machinery-armour-panel')).toBe(true);
    expect(coreMaterials).toContain(cache.glow('player', 2.6));
    expect(materials(relay.group)).not.toContain(hull);
    expect(materials(relay.group).some((m) => m.name.startsWith('machinery-'))).toBe(true);
    expect({ map: hull.map, bumpMap: hull.bumpMap, color: hull.color.getHex() }).toEqual(original);
    expect(core.column).not.toBeNull();
    expect(core.spinners).toHaveLength(4);
    expect(core.generationParts.every(({ part }) => !part.visible)).toBe(true);
    expect(core.pickable.every((mesh) => mesh.userData.entityId === 'core')).toBe(true);
    cache.dispose();
  });

  it('shares maps and geometry, uses independent data channels, and releases textures', () => {
    const cache = new ResourceCache();
    const first = buildBuildingModel(cache, 'core', 'player', 'first');
    const second = buildBuildingModel(cache, 'core', 'player', 'second');
    const finish = materials(first.group).find((m) => m.name === 'machinery-armour-panel')!;
    expect(materials(second.group)).toContain(finish);
    expect(finish.map).not.toBe(finish.bumpMap);
    expect(finish.roughnessMap).toBe(finish.metalnessMap);
    expect(finish.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(finish.bumpMap!.colorSpace).toBe(THREE.NoColorSpace);
    const textures = new Set(materials(first.group).filter((m) => m.name.startsWith('machinery-')).flatMap((m) => [m.map!, m.bumpMap!, m.roughnessMap!]));
    const disposed = new Set<THREE.Texture>();
    for (const texture of textures) texture.addEventListener('dispose', () => disposed.add(texture));
    const geometries = new Set<THREE.BufferGeometry>();
    first.group.traverse((o) => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
    second.group.traverse((o) => { if (o instanceof THREE.Mesh) expect(geometries.has(o.geometry)).toBe(true); });
    cache.dispose();
    expect(disposed.size).toBe(textures.size);
  });

  it('covers every building and unit for both factions, including hidden upgrades', () => {
    const cache = new ResourceCache();
    for (const team of ['player', 'enemy'] as const) {
      const models = [
        ...(Object.keys(BUILDINGS) as BuildingTypeId[]).map((kind) => buildBuildingModel(cache, kind, team, kind)),
        ...(['worker', 'striker', 'ranger', 'scout', 'titan'] as const).map((kind) => buildUnitModel(cache, kind, team, kind)),
      ];
      for (const model of models) {
        const finishes = materials(model.group);
        expect(finishes.some((m) => m.name.startsWith('machinery-'))).toBe(true);
        expect(finishes).not.toContain(cache.hull(team));
        expect(finishes).not.toContain(cache.armour(team));
        expect(finishes).not.toContain(cache.frame(team));
        expect(model.pickable.length).toBeGreaterThan(0);
        model.group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const attribute of ['position', 'normal', 'uv']) {
            const values = object.geometry.getAttribute(attribute);
            expect(values, attribute).toBeDefined();
            expect(Array.from(values.array).every(Number.isFinite)).toBe(true);
          }
        });
      }
    }
    cache.dispose();
  });

  it('uses lighter unit armour and finer relief while sharing texture maps across factions', () => {
    const cache = new ResourceCache();
    const core = materials(buildBuildingModel(cache, 'core', 'player', 'core').group).find((m) => m.name === 'machinery-armour-panel')!;
    const unit = materials(buildUnitModel(cache, 'striker', 'player', 'striker').group).find((m) => m.name === 'machinery-armour-panel')!;
    const enemy = materials(buildUnitModel(cache, 'striker', 'enemy', 'enemy').group).find((m) => m.name === 'machinery-armour-panel')!;
    expect(unit.map).toBe(core.map);
    expect(enemy.map).toBe(unit.map);
    expect(enemy).not.toBe(unit);
    expect(enemy.color.getHex()).not.toBe(unit.color.getHex());
    expect(unit.color.r).toBeGreaterThan(core.color.r);
    expect(unit.bumpScale).toBeLessThan(core.bumpScale);
    cache.dispose();
  });
});
