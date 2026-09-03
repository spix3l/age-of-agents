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
 * Matter is a cluster of heavy metallic boulders on a scree bed; Energy is a geothermal vent
 * of glowing crystal blades. Both keep a recognisable silhouette at default zoom.
 */
export function buildResourceModel(cache: ResourceCache, type: HarvestableResourceType, id: string): ResourceModel {
  const group = new THREE.Group();
  const shards: THREE.Object3D[] = [];
  const pickable: THREE.Object3D[] = [];
  const isMatter = type === 'matter';
  const isEnergy = type === 'energy';

  const bed = new THREE.Mesh(
    cache.geometry(`${type}-bed`, () => new THREE.CylinderGeometry(isMatter ? 2 : 1.7, isMatter ? 2.3 : 2, 0.24, isMatter ? 7 : isEnergy ? 6 : 8)),
    cache.standard(`${type}-bed-mat`, {
      color: isMatter ? 0x6d5b41 : isEnergy ? 0x2c4f4d : 0x493e62,
      roughness: 0.95,
      metalness: 0.05,
    }),
  );
  bed.position.y = 0.12;
  bed.receiveShadow = true;
  bed.userData.entityId = id;
  pickable.push(bed);
  group.add(bed);

  const bodyMaterial = cache.standard(`${type}-body`, isMatter
    ? { color: 0xc9a25c, emissive: 0x4a2f10, emissiveIntensity: 0.18, roughness: 0.7, metalness: 0.45 }
    : isEnergy
      ? { color: 0x4fd6c4, emissive: 0x18a496, emissiveIntensity: 1.1, roughness: 0.22, metalness: 0.1 }
      : { color: 0xb99cff, emissive: 0x7654d6, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.16 });

  const count = isMatter ? 7 : isEnergy ? 6 : 5;
  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(
      cache.geometry(`${type}-shard-${index % 3}`, () => (isMatter
        ? new THREE.DodecahedronGeometry(0.62 + (index % 3) * 0.22, 0)
        : isEnergy
          ? new THREE.ConeGeometry(0.34 + (index % 3) * 0.08, 1.8 + (index % 3) * 0.6, 5)
          : new THREE.OctahedronGeometry(0.48 + (index % 3) * 0.12, 0))),
      bodyMaterial,
    );
    const angle = (index / count) * Math.PI * 2;
    const radius = isMatter ? 0.95 : isEnergy ? 0.8 : 1.05;
    mesh.position.set(Math.cos(angle) * radius, isMatter ? 0.5 : isEnergy ? 1.05 : 0.85 + (index % 2) * 0.65, Math.sin(angle) * radius);
    mesh.rotation.set(isMatter ? index * 0.2 : (index - 3) * 0.06, angle, isMatter ? index * 0.14 : (index - 3) * 0.05);
    mesh.castShadow = true;
    mesh.userData.entityId = id;
    pickable.push(mesh);
    shards.push(mesh);
    group.add(mesh);
  }

  if (isEnergy || type === 'data') {
    const halo = new THREE.Mesh(
      cache.geometry(`${type}-halo`, () => new THREE.TorusGeometry(type === 'data' ? 1.42 : 1.15, type === 'data' ? 0.08 : 0.05, 6, 20)),
      cache.standard(`${type}-halo-mat`, type === 'data'
        ? { color: 0xd1bdff, emissive: 0x8e6bea, emissiveIntensity: 1.8, roughness: 0.25 }
        : { color: 0x7ff2e2, emissive: 0x35d8c0, emissiveIntensity: 1.6, roughness: 0.3 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.35;
    group.add(halo);
    shards.push(halo);
  }

  return { group, shards, pickable };
}
