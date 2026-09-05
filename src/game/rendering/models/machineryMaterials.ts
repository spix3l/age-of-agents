import * as THREE from 'three';
import type { ResourceCache } from './palette';
import type { Team } from '../../types/simulation';

type Finish = 'armour' | 'paint' | 'chassis' | 'steel';
type Channel = 'color' | 'surface' | 'height';
const SIZE = 256;

/** Small, deterministic, lighting-free maps. Detail follows a manufactured panel, not noise.
 * Surface packs roughness in green and metalness in blue; height is independent of colour.
 * Edge grime is painted cavity shading, not a claim of geometry-baked ambient occlusion.
 */
function makeMap(finish: Finish, channel: Channel, panel: boolean): THREE.DataTexture {
  const bytes = new Uint8Array(SIZE * SIZE * 4);
  let seed = 8137;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = seed / 0xffffffff;
    const u = (x + 0.5) / SIZE; const v = (y + 0.5) / SIZE;
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const painted = finish === 'armour' || finish === 'paint';
    const cavity = panel ? Math.exp(-edge * 65) : 0;
    const border = panel && edge > 0.058 && edge < 0.065;
    const rim = panel && edge > 0.066 && edge < 0.073;
    const wear = panel && edge < 0.018 && grain > 0.64 && Math.sin(x * 0.23 + y * 0.17) > 0.2;
    const scratch = panel && v > 0.78 && v < 0.785 && u > 0.22 && u < 0.39;
    // Tiny service stencil bars; no large repeated fake text or baked highlights.
    const stencil = panel && painted && u > 0.16 && u < 0.31 &&
      ((v > 0.17 && v < 0.183) || (u < 0.25 && v > 0.197 && v < 0.206));
    const serviceSlot = panel && u > 0.61 && u < 0.81 &&
      ((v > 0.72 && v < 0.735) || (v > 0.755 && v < 0.77) || (v > 0.79 && v < 0.805));
    const mottle = Math.sin(u * 23 + Math.sin(v * 11)) * Math.sin(v * 19) * 0.012;
    let value = 0.93 + mottle + (grain - 0.5) * 0.014 - cavity * 0.25;
    if (border) value *= 0.62;
    if (rim) value = 0.99;
    if (wear || scratch) value = 0.99;
    if (stencil) value = 0.66;
    if (serviceSlot) value = 0.3;
    let roughness = (finish === 'steel' ? 0.27 : finish === 'chassis' ? 0.57 : 0.41) +
      mottle * 3 + (grain - 0.5) * 0.035 + cavity * 0.15;
    let metalness = painted ? 0.2 : 0.68;
    if (wear || scratch) { roughness = 0.32; metalness = 0.82; }
    const height = serviceSlot ? 0.25 : border ? 0.38 : wear || scratch ? 0.47 : 0.5 + (grain - 0.5) * 0.008;
    const i = (y * SIZE + x) * 4;
    const rgb = channel === 'color' ? [value, value, value] :
      channel === 'surface' ? [1, roughness, metalness] : [height, height, height];
    for (let c = 0; c < 3; c++) bytes[i + c] = Math.round(THREE.MathUtils.clamp(rgb[c]!, 0, 1) * 255);
    bytes[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, SIZE, SIZE, THREE.RGBAFormat);
  texture.name = `machinery-${finish}-${panel ? 'panel' : 'cast'}-${channel}`;
  texture.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Box/extrusion UVs differ: project each face into its own [0,1] panel before batching.
 * Work on cached clones; never change geometry shared with another building or unit.
 */
function panelUVs(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const positions = geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    const normal = b.sub(a).cross(c.sub(a));
    const nx = Math.abs(normal.x); const ny = Math.abs(normal.y); const nz = Math.abs(normal.z);
    const axes: ['x' | 'y' | 'z', 'x' | 'y' | 'z'] = nz >= nx && nz >= ny ? ['x', 'y'] : nx >= ny ? ['z', 'y'] : ['x', 'z'];
    for (let j = 0; j < 3; j++) {
      a.fromBufferAttribute(positions, i + j);
      uv[(i + j) * 2] = (a[axes[0]] - bounds.min[axes[0]]) / Math.max(size[axes[0]], 0.00001);
      uv[(i + j) * 2 + 1] = (a[axes[1]] - bounds.min[axes[1]]) / Math.max(size[axes[1]], 0.00001);
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Apply before batching so panels retain face-local UVs and detail follows animated joints.
 * Base materials, emitters and source geometry remain untouched. Unit bump depth is reduced
 * to match their smaller parts; maps are shared by every model and faction in the cache.
 */
export function applyMachineryMaterials(group: THREE.Group, cache: ResourceCache, team: Team, profile: 'building' | 'unit' = 'building'): void {
  const finishes = new Map<THREE.Material, Finish>([
    [cache.hull(team), 'armour'], [cache.plate(team), 'paint'],
    [cache.plateDark(team), 'chassis'], [cache.frame(team), 'chassis'],
    [cache.panel(), 'chassis'], [cache.steel(), 'steel'],
    [cache.armour(team), 'armour'],
  ]);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const original = object.material;
    const finish = finishes.get(original);
    if (!finish) return;
    // Only large armour faces get seams/stencils. Cylinders, bolts and narrow trim remain clean.
    object.geometry.computeBoundingBox();
    const size = object.geometry.boundingBox!.getSize(new THREE.Vector3());
    const dimensions = [size.x, size.y, size.z].sort((a, b) => b - a);
    const minimum = profile === 'unit' ? 0.28 : 0.5;
    const panel = (finish === 'armour' || finish === 'paint') &&
      ['BoxGeometry', 'RoundedBoxGeometry', 'ExtrudeGeometry'].includes(object.geometry.type) && dimensions[1]! > minimum;
    if (panel) {
      const source = object.geometry;
      object.geometry = cache.geometry(`machinery-panel-uv-${source.uuid}`, () => panelUVs(source));
    }
    const map = (channel: Channel) => cache.texture(`machinery-${finish}-${panel}-${channel}`, () => makeMap(finish, channel, panel));
    const color = original.color.clone();
    if (finish === 'armour') color.multiplyScalar(1.04);
    if (finish === 'chassis') color.multiplyScalar(0.88);
    object.material = cache.standard(`machinery-finish-${original.uuid}-${panel}-${profile}`, {
      name: `machinery-${finish}-${panel ? 'panel' : 'cast'}`, color,
      map: map('color'), roughnessMap: map('surface'), metalnessMap: map('surface'),
      bumpMap: map('height'), bumpScale: (panel ? 0.018 : 0.004) * (profile === 'unit' ? 0.25 : 1),
      roughness: 1, metalness: 1, envMapIntensity: 1.4,
    });
  });
}
