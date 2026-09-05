import * as THREE from 'three';

/** Seamless seeded microtexture, independent of DOM and external asset loading. */
export function surfaceTexture(size: number, terrain = false): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  let seed = 7193;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296;
      const grain = terrain ? 140 + noise * 110 : 205 + noise * 28;
      const i = (y * size + x) * 4;
      pixels[i] = grain;
      pixels[i + 1] = grain;
      pixels[i + 2] = terrain ? grain * 0.87 : grain;
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
