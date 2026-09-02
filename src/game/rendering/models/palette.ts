import * as THREE from 'three';
import type { Team } from '../../types/simulation';

export interface TeamPalette {
  /** Painted plating that carries faction identity. */
  readonly plate: number;
  /** Structural hull shared across factions. */
  readonly hull: number;
  /** Shadowed mechanical parts: joints, tracks, undercarriage. */
  readonly frame: number;
  /** Glowing optics, energy cores, weapon charge. */
  readonly glow: number;
}

export const TEAM_PALETTE: Readonly<Record<Team, TeamPalette>> = Object.freeze({
  player: { plate: 0x2196a8, hull: 0xd5d8cf, frame: 0x27373c, glow: 0x8ef8e4 },
  enemy: { plate: 0xc25340, hull: 0xd8cfc4, frame: 0x3a2a26, glow: 0xffc07a },
  neutral: { plate: 0x8b8f86, hull: 0xcfd2c8, frame: 0x33383a, glow: 0xbfe9df },
});

export function paletteFor(team: Team): TeamPalette {
  return TEAM_PALETTE[team] ?? TEAM_PALETTE.neutral;
}

/**
 * Shared geometry and material caches. Every Agent of a kind reuses the same buffers, so a
 * sixty-unit battle costs a handful of GPU resources instead of hundreds.
 */
export class ResourceCache {
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.Material>();

  geometry<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
    const existing = this.geometries.get(key);
    if (existing) return existing as T;
    const created = build();
    this.geometries.set(key, created);
    return created;
  }

  standard(key: string, options: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing as THREE.MeshStandardMaterial;
    const created = new THREE.MeshStandardMaterial({ flatShading: true, ...options });
    this.materials.set(key, created);
    return created;
  }

  basic(key: string, options: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing as THREE.MeshBasicMaterial;
    const created = new THREE.MeshBasicMaterial(options);
    this.materials.set(key, created);
    return created;
  }

  plate(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`plate-${team}`, { color: paletteFor(team).plate, roughness: 0.42, metalness: 0.45 });
  }

  hull(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`hull-${team}`, { color: paletteFor(team).hull, roughness: 0.68, metalness: 0.12 });
  }

  frame(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`frame-${team}`, { color: paletteFor(team).frame, roughness: 0.55, metalness: 0.6 });
  }

  glow(team: Team, intensity = 1.6): THREE.MeshStandardMaterial {
    const color = paletteFor(team).glow;
    return this.standard(`glow-${team}-${intensity}`, {
      color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0,
    });
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}
