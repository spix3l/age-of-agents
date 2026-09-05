import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ResourceCache } from '../../game/rendering/models/palette';
import { buildBuildingModel } from '../../game/rendering/models/buildings';
import { buildUnitModel } from '../../game/rendering/models/units';
import { BUILDINGS } from '../../data/buildings';
import type { BuildingTypeId, UnitTypeId } from '../../game/types/ids';

const portraits = new Map<string, string>();

/** Render once and release the WebGL context; HUD updates only display cached images. */
function renderPortrait(kind: BuildingTypeId | UnitTypeId): string {
  const cached = portraits.get(kind);
  if (cached) return cached;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const cache = new ResourceCache();
  try {
    renderer.setSize(256, 256);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const model = kind in BUILDINGS
      ? buildBuildingModel(cache, kind as BuildingTypeId, 'player', 'portrait').group
      : buildUnitModel(cache, kind as UnitTypeId, 'player', 'portrait').group;
    scene.add(model, new THREE.HemisphereLight(0xd5e8ff, 0x475046, 2));
    if (!(kind in BUILDINGS)) model.rotation.y = Math.PI;
    const key = new THREE.DirectionalLight(0xffefd8, 3);
    key.position.set(-3, 8, 6);
    scene.add(key);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y * 0.85, size.z) * 0.7;
    const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.1, 100);
    camera.position.copy(center).add(new THREE.Vector3(7, 7, 11));
    camera.lookAt(center);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    portraits.set(kind, url);
    return url;
  } finally {
    cache.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

export function ModelPortrait({ kind }: { readonly kind: BuildingTypeId | UnitTypeId }) {
  const [url, setUrl] = useState(() => portraits.get(kind));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setUrl(renderPortrait(kind)); } catch { /* Text labels remain usable without WebGL. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind]);
  return url ? <img className="model-portrait" src={url} alt="" draggable={false} /> : <span className="portrait-placeholder" aria-hidden="true">⬡</span>;
}
