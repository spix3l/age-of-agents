import * as THREE from 'three';
import type { HarvestableResourceType } from '../../types/simulation';
import type { ResourceCache } from './palette';

export interface ResourceModel {
  readonly group: THREE.Group;
  /** Shards that bob or rotate so a live deposit reads differently from a spent one. */
  readonly shards: THREE.Object3D[];
  readonly pickable: THREE.Object3D[];
}

/**
 * Matter is a pile of grey boulders shot through with gold ore; Energy is a geothermal vent
 * of glowing teal crystal; Data is a ring of violet archive obelisks around a halo. Each keeps
 * a recognisable silhouette and colour at default zoom.
 */
export function buildResourceModel(cache: ResourceCache, type: HarvestableResourceType, id: string): ResourceModel {
  const group = new THREE.Group();
  const shards: THREE.Object3D[] = [];
  const pickable: THREE.Object3D[] = [];
  const isMatter = type === 'matter';
  const isEnergy = type === 'energy';

  const bed = new THREE.Mesh(
    cache.geometry(`${type}-bed`, () => new THREE.CylinderGeometry(isMatter ? 2.0 : 1.7, isMatter ? 2.4 : 2.1, 0.3, isMatter ? 9 : isEnergy ? 7 : 8)),
    cache.standard(`${type}-bed-mat`, {
      color: isMatter ? 0x8a6f4e : isEnergy ? 0x3a5e5a : 0x4b4166,
      roughness: 0.98,
      metalness: 0.02,
    }),
  );
  bed.position.y = 0.1;
  bed.receiveShadow = true;
  bed.userData.entityId = id;
  pickable.push(bed);
  group.add(bed);

  if (isMatter) {
    const stone = cache.standard('matter-stone', { color: 0x9b9489, roughness: 0.92, metalness: 0.05 });
    const ore = cache.standard('matter-ore', { color: 0xf0b83c, emissive: 0x6d4a08, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.6 });
    const layout: Array<[number, number, number, number]> = [[0, 0, 1.15, 0], [0.95, 0.35, 0.8, 1.1], [-0.9, 0.5, 0.75, 2.3], [0.2, -1.0, 0.7, 0.6], [-0.4, 1.05, 0.62, 1.8], [1.1, -0.7, 0.55, 2.9]];
    for (const [index, [x, z, size, spin]] of layout.entries()) {
      const rock = new THREE.Mesh(cache.geometry(`matter-rock-${index % 3}`, () => new THREE.DodecahedronGeometry(1, 0)), stone);
      rock.position.set(x, size * 0.55, z);
      rock.scale.set(size * 1.1, size * 0.8, size);
      rock.rotation.set(index * 0.4, spin, index * 0.2);
      rock.castShadow = true; rock.receiveShadow = true;
      rock.userData.entityId = id;
      pickable.push(rock); shards.push(rock); group.add(rock);
      const nugget = new THREE.Mesh(cache.geometry('matter-nugget', () => new THREE.OctahedronGeometry(0.26, 0)), ore);
      nugget.position.set(x + Math.cos(spin) * size * 0.55, size * 0.75, z + Math.sin(spin) * size * 0.55);
      nugget.rotation.set(spin, index, 0);
      nugget.castShadow = true;
      nugget.userData.entityId = id;
      pickable.push(nugget); shards.push(nugget); group.add(nugget);
    }
    return { group, shards, pickable };
  }

  const bodyMaterial = cache.standard(`${type}-body`, isEnergy
    ? { color: 0x5fe3d0, emissive: 0x1fb3a2, emissiveIntensity: 1.1, roughness: 0.22, metalness: 0.1 }
    : { color: 0xc3a4ff, emissive: 0x7d5ae0, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.16 });
  const count = isEnergy ? 7 : 5;
  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(
      cache.geometry(`${type}-shard-${index % 3}`, () => (isEnergy
        ? new THREE.ConeGeometry(0.3 + (index % 3) * 0.1, 1.6 + (index % 3) * 0.7, 5)
        : new THREE.CylinderGeometry(0.18, 0.3, 1.5 + (index % 2) * 0.5, 4))),
      bodyMaterial,
    );
    const angle = (index / count) * Math.PI * 2;
    const radius = isEnergy ? (index === 0 ? 0 : 0.85) : 1.1;
    mesh.position.set(Math.cos(angle) * radius, isEnergy ? 0.9 : 0.95 + (index % 2) * 0.25, Math.sin(angle) * radius);
    mesh.rotation.set(isEnergy ? (index === 0 ? 0 : 0.22) : 0, angle + (isEnergy ? 0 : Math.PI / 4), isEnergy && index > 0 ? 0.14 : 0);
    if (isEnergy && index > 0) mesh.rotation.z = Math.cos(angle) * 0.28;
    mesh.castShadow = true;
    mesh.userData.entityId = id;
    pickable.push(mesh);
    shards.push(mesh);
    group.add(mesh);
  }

  const halo = new THREE.Mesh(
    cache.geometry(`${type}-halo`, () => new THREE.TorusGeometry(type === 'data' ? 1.42 : 1.15, type === 'data' ? 0.07 : 0.05, 6, 20)),
    cache.standard(`${type}-halo-mat`, type === 'data'
      ? { color: 0xd8c7ff, emissive: 0x9a7cf0, emissiveIntensity: 1.8, roughness: 0.25 }
      : { color: 0x8ff6e6, emissive: 0x3fe0c6, emissiveIntensity: 1.6, roughness: 0.3 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.35;
  group.add(halo);
  shards.push(halo);

  return { group, shards, pickable };
}
