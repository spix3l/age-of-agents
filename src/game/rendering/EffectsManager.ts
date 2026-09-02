import * as THREE from 'three';
import { COMBAT } from '../../data/combat';
import type { Team, Vec2 } from '../types/simulation';

type EffectKind = 'shot' | 'impact' | 'death';

interface ActiveEffect {
  readonly kind: EffectKind;
  readonly object: THREE.Object3D;
  life: number;
  readonly duration: number;
}

const TEAM_COLORS: Readonly<Record<Team, number>> = { player: 0x7ef2ff, enemy: 0xffb257, neutral: 0xd8d8d8 };

/**
 * Pooled laser, impact, and destruction visuals. Purely presentational: damage is resolved by
 * CombatSystem/DamageService, so a missing or dropped effect can never change the simulation.
 */
export class EffectsManager {
  private readonly pools: Record<EffectKind, THREE.Object3D[]> = { shot: [], impact: [], death: [] };
  private readonly active: ActiveEffect[] = [];
  private readonly shotGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 5, 1, true);
  private readonly impactGeometry = new THREE.IcosahedronGeometry(0.42, 0);
  private readonly deathGeometry = new THREE.IcosahedronGeometry(0.75, 0);
  private readonly created: Record<EffectKind, number> = { shot: 0, impact: 0, death: 0 };
  private dropped = 0;

  constructor(private readonly scene: THREE.Object3D, private readonly maxActive = COMBAT.maxActiveEffects) {}

  get activeCount(): number { return this.active.length; }
  get pooledCount(): number { return this.pools.shot.length + this.pools.impact.length + this.pools.death.length; }
  get createdCount(): number { return this.created.shot + this.created.impact + this.created.death; }
  get droppedCount(): number { return this.dropped; }

  spawnShot(from: Vec2, to: Vec2, team: Team, fromHeight = 1, toHeight = 0.9): void {
    const object = this.take('shot', team);
    if (!object) return;
    const start = new THREE.Vector3(from.x, fromHeight, from.z);
    const end = new THREE.Vector3(to.x, toHeight, to.z);
    const length = Math.max(0.2, start.distanceTo(end));
    object.position.copy(start).lerp(end, 0.5);
    object.scale.set(1, length, 1);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    this.push('shot', object, COMBAT.shotEffectSeconds);
  }

  spawnImpact(at: Vec2, team: Team, height = 0.9): void {
    const object = this.take('impact', team);
    if (!object) return;
    object.position.set(at.x, height, at.z);
    object.scale.setScalar(1);
    this.push('impact', object, COMBAT.impactEffectSeconds);
  }

  spawnDeath(at: Vec2, team: Team, scale = 1): void {
    const object = this.take('death', team);
    if (!object) return;
    object.position.set(at.x, 0.7 * scale, at.z);
    object.scale.setScalar(scale);
    this.push('death', object, COMBAT.deathEffectSeconds);
  }

  update(delta: number): void {
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const effect = this.active[index]!;
      effect.life -= delta;
      const ratio = Math.max(0, effect.life / effect.duration);
      const material = (effect.object as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = effect.kind === 'shot' ? ratio : ratio * 0.85;
      if (effect.kind === 'death') effect.object.scale.setScalar((1 + (1 - ratio) * 1.6) * 0.9);
      if (effect.kind === 'impact') effect.object.scale.setScalar(0.5 + (1 - ratio) * 0.9);
      if (effect.life > 0) continue;
      this.active.splice(index, 1);
      effect.object.visible = false;
      this.pools[effect.kind].push(effect.object);
    }
  }

  dispose(): void {
    for (const effect of this.active) this.scene.remove(effect.object);
    for (const kind of ['shot', 'impact', 'death'] as const) {
      for (const object of this.pools[kind]) this.scene.remove(object);
      this.pools[kind].length = 0;
    }
    this.active.length = 0;
    this.shotGeometry.dispose();
    this.impactGeometry.dispose();
    this.deathGeometry.dispose();
  }

  private take(kind: EffectKind, team: Team): THREE.Object3D | null {
    if (this.active.length >= this.maxActive) { this.dropped += 1; return null; }
    const pooled = this.pools[kind].pop();
    const object = pooled ?? this.create(kind);
    const material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial;
    material.color.setHex(TEAM_COLORS[team]);
    material.opacity = 1;
    object.visible = true;
    return object;
  }

  private create(kind: EffectKind): THREE.Object3D {
    const geometry = kind === 'shot' ? this.shotGeometry : kind === 'impact' ? this.impactGeometry : this.deathGeometry;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false }));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.created[kind] += 1;
    return mesh;
  }

  private push(kind: EffectKind, object: THREE.Object3D, duration: number): void {
    this.active.push({ kind, object, life: duration, duration });
  }
}
