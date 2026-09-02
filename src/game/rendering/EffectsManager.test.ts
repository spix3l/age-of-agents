import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COMBAT } from '../../data/combat';
import { EffectsManager } from './EffectsManager';

describe('EffectsManager', () => {
  it('expires effects on simulation-independent frame time and reuses pooled objects', () => {
    const scene = new THREE.Scene();
    const effects = new EffectsManager(scene);
    effects.spawnShot({ x: 0, z: 0 }, { x: 4, z: 0 }, 'player');
    effects.spawnImpact({ x: 4, z: 0 }, 'player');
    expect(effects.activeCount).toBe(2);
    expect(effects.pooledCount).toBe(0);

    effects.update(COMBAT.shotEffectSeconds + COMBAT.impactEffectSeconds);
    expect(effects.activeCount).toBe(0);
    expect(effects.pooledCount).toBe(2);

    const created = effects.createdCount;
    for (let index = 0; index < 20; index += 1) {
      effects.spawnShot({ x: 0, z: 0 }, { x: 1, z: 1 }, 'enemy');
      effects.update(COMBAT.shotEffectSeconds);
    }
    expect(effects.createdCount).toBe(created);
    expect(effects.activeCount).toBe(0);
  });

  it('bounds active effects during a 60-unit fight and never grows the scene without limit', () => {
    const scene = new THREE.Scene();
    const effects = new EffectsManager(scene);
    for (let index = 0; index < 600; index += 1) {
      effects.spawnShot({ x: index % 30, z: 0 }, { x: index % 30, z: 4 }, index % 2 === 0 ? 'player' : 'enemy');
      effects.spawnImpact({ x: index % 30, z: 4 }, 'enemy');
      effects.spawnDeath({ x: index % 30, z: 4 }, 'enemy');
    }
    expect(effects.activeCount).toBe(COMBAT.maxActiveEffects);
    expect(effects.droppedCount).toBeGreaterThan(0);
    expect(scene.children.length).toBe(COMBAT.maxActiveEffects);

    effects.update(2);
    expect(effects.activeCount).toBe(0);
    expect(effects.pooledCount).toBe(COMBAT.maxActiveEffects);

    effects.dispose();
    expect(scene.children.length).toBe(0);
  });
});
