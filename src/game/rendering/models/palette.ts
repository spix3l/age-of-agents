import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Team } from '../../types/simulation';

export interface TeamPalette {
  /** Painted plating that carries faction identity: roofs, shoulder pads, banners. */
  readonly plate: number;
  /** A deeper shade of the same paint for undersides and trim. */
  readonly plateDark: number;
  /** Structural hull shared across factions: warm ceramic white. */
  readonly hull: number;
  /** Shadowed mechanical parts: joints, tracks, undercarriage. */
  readonly frame: number;
  /** Glowing optics, energy cores, weapon charge. */
  readonly glow: number;
}

/**
 * Factions read as blue versus red from across the map, the way toy armies do. Hull, frame,
 * and the warm hazard accents are shared so a colony reads as one material language.
 */
export const TEAM_PALETTE: Readonly<Record<Team, TeamPalette>> = Object.freeze({
  player: { plate: 0x5286b0, plateDark: 0x3a6187, hull: 0x8e98a3, frame: 0x4f5761, glow: 0x3fe4ff },
  enemy: { plate: 0xb05645, plateDark: 0x7d3a2f, hull: 0x968d88, frame: 0x5a4d4b, glow: 0xff7a3a },
  neutral: { plate: 0x858c92, plateDark: 0x5f656b, hull: 0x8b9299, frame: 0x4e555b, glow: 0xbfe9df },
});

/** Units wear lighter armour than structures so they pop against the dark colony. */
export const UNIT_ARMOUR = Object.freeze({ player: 0xe6ebee, enemy: 0xe4dcd6, neutral: 0xd0d4d8 });

/** Shared accents: hazard yellow, dark glass, weathered steel, and a warm roof-tile red. */
export const ACCENT = Object.freeze({
  hazard: 0xf29a2e,
  glass: 0x0f1a22,
  steel: 0x8e979f,
  copper: 0xc47a3a,
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

  /** A softly bevelled box: the rounded edge is what turns a cube into a toy block. */
  roundedBox(key: string, width: number, height: number, depth: number, radius = 0.08): THREE.BufferGeometry {
    return this.geometry(key, () => new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, Math.min(width, height, depth) / 2.2)));
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
    return this.standard(`plate-${team}`, { color: paletteFor(team).plate, roughness: 0.6, metalness: 0.08 });
  }

  plateDark(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`plate-dark-${team}`, { color: paletteFor(team).plateDark, roughness: 0.66, metalness: 0.1 });
  }

  hull(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`hull-${team}`, { color: paletteFor(team).hull, roughness: 0.66, metalness: 0.06 });
  }

  /** Light armour plating for Agents. */
  armour(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`armour-${team}`, { color: UNIT_ARMOUR[team] ?? UNIT_ARMOUR.neutral, roughness: 0.55, metalness: 0.15 });
  }

  /** Warning-orange lamps and stripes shared by every faction. */
  amber(): THREE.MeshStandardMaterial {
    return this.standard('accent-amber', { color: ACCENT.hazard, emissive: ACCENT.hazard, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0 });
  }

  frame(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`frame-${team}`, { color: paletteFor(team).frame, roughness: 0.6, metalness: 0.12 });
  }

  glow(team: Team, intensity = 1.6): THREE.MeshStandardMaterial {
    const color = paletteFor(team).glow;
    // Emissive is kept below clipping so strips stay saturated cyan instead of blowing to white.
    return this.standard(`glow-${team}-${intensity}`, {
      color, emissive: color, emissiveIntensity: intensity * 0.42, roughness: 0.3, metalness: 0,
    });
  }

  hazard(): THREE.MeshStandardMaterial {
    return this.standard('accent-hazard', { color: ACCENT.hazard, roughness: 0.7, metalness: 0.05 });
  }

  glass(): THREE.MeshStandardMaterial {
    return this.standard('accent-glass', { color: ACCENT.glass, roughness: 0.3, metalness: 0.1 });
  }

  steel(): THREE.MeshStandardMaterial {
    return this.standard('accent-steel', { color: ACCENT.steel, roughness: 0.55, metalness: 0.15 });
  }

  copper(): THREE.MeshStandardMaterial {
    return this.standard('accent-copper', { color: ACCENT.copper, roughness: 0.55, metalness: 0.35 });
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}
