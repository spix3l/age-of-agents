import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Team } from '../../types/simulation';
import { surfaceTexture } from './surface';

export interface TeamPalette {
  /** Faction-tinted accent plating: shoulder pads, roof caps, banners. */
  readonly plate: number;
  /** A deeper shade of the same paint for undersides and trim. */
  readonly plateDark: number;
  /** The bright armour plate that reads as white under key light. Shared across factions. */
  readonly hull: number;
  /** The dark navy chassis every plate is bolted onto. Shared across factions. */
  readonly frame: number;
  /** Glowing strips, optics, energy cores, weapon charge. */
  readonly glow: number;
}

/**
 * The art direction in `models/tile_*.png`: heavy gunmetal armour, layered light-grey plates over
 * a dark navy chassis, seams pouring cyan light, and amber used sparingly on vents and hazard
 * trim. Machinery reads dark and saturated against a bright green valley.
 *
 * Chassis, armour, and hazard amber are identical for both factions, so the two colonies read as
 * the same engineering built by different owners. Only the accent paint and the emissive colour
 * carry identity — cyan against amber, which stays legible for red/green colour blindness because
 * the two also differ strongly in brightness.
 */
export const TEAM_PALETTE: Readonly<Record<Team, TeamPalette>> = Object.freeze({
  player: { plate: 0x515a60, plateDark: 0x2c353b, hull: 0x9b9b96, frame: 0x242b30, glow: 0x29d5f5 },
  enemy: { plate: 0x6a5044, plateDark: 0x44322a, hull: 0x9a8f88, frame: 0x2a2220, glow: 0xf5a623 },
  neutral: { plate: 0x51585f, plateDark: 0x353b41, hull: 0x8b9299, frame: 0x232830, glow: 0x9fd0d8 },
});

/** Agents wear a lighter armour than structures so a moving Agent pops against its own colony. */
export const UNIT_ARMOUR = Object.freeze({ player: 0xb9c4cf, enemy: 0xc0b6ad, neutral: 0xb2b8bd });

/** Shared accents: hazard amber, dark glass, brushed steel, and the mid-grey panel fill. */
export const ACCENT = Object.freeze({
  hazard: 0xff9a2e,
  glass: 0x0a1018,
  steel: 0x9aa5b1,
  copper: 0xd08a3c,
  /** The medium blue-grey between the white plates and the navy chassis. */
  panel: 0x39434f,
});

export function paletteFor(team: Team): TeamPalette {
  return TEAM_PALETTE[team] ?? TEAM_PALETTE.neutral;
}

/**
 * Shared geometry and material caches. Every Agent of a kind reuses the same buffers, so a
 * hundred-unit battle costs a handful of GPU resources instead of hundreds.
 */
export class ResourceCache {
  private readonly surface = surfaceTexture(64);
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.Material>();
  private readonly textures = new Map<string, THREE.Texture>();

  /** Lazily owned maps: material disposal alone does not release GPU textures. */
  texture<T extends THREE.Texture>(key: string, build: () => T): T {
    const existing = this.textures.get(key);
    if (existing) return existing as T;
    const created = build();
    this.textures.set(key, created);
    return created;
  }

  geometry<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
    const existing = this.geometries.get(key);
    if (existing) return existing as T;
    const created = build();
    this.geometries.set(key, created);
    return created;
  }

  /** A crisply bevelled box. The chamfer is what catches the key light along a panel edge. */
  roundedBox(key: string, width: number, height: number, depth: number, radius = 0.06): THREE.BufferGeometry {
    return this.geometry(key, () => new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, Math.min(width, height, depth) / 2.2)));
  }

  standard(key: string, options: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing as THREE.MeshStandardMaterial;
    // Smooth shading by default: the reference reads as moulded, machined armour, and flat
    // shading turned every bevel into a facet.
    const created = new THREE.MeshStandardMaterial(options);
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

  /** Faction accent paint. Used in narrow bands, never as the dominant surface. */
  plate(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`plate-${team}`, { color: paletteFor(team).plate, roughness: 0.38, metalness: 0.45 });
  }

  plateDark(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`plate-dark-${team}`, { color: paletteFor(team).plateDark, roughness: 0.44, metalness: 0.45 });
  }

  /** The main armour plate: light gunmetal, the largest surface on any structure. */
  hull(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`hull-${team}`, { color: paletteFor(team).hull, map: this.surface, bumpMap: this.surface, bumpScale: 0.025, roughness: 0.62, metalness: 0.25 });
  }

  /** Light armour plating for Agents; the same white as structures. */
  armour(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`armour-${team}`, { color: UNIT_ARMOUR[team] ?? UNIT_ARMOUR.neutral, map: this.surface, bumpMap: this.surface, bumpScale: 0.008, roughness: 0.6, metalness: 0.28 });
  }

  /** The dark navy chassis everything is bolted onto. Glossy, so it catches a rim highlight. */
  frame(team: Team): THREE.MeshStandardMaterial {
    return this.standard(`frame-${team}`, { color: paletteFor(team).frame, roughness: 0.34, metalness: 0.62 });
  }

  /** The mid blue-grey between white plate and navy chassis. Breaks up large armour faces. */
  panel(): THREE.MeshStandardMaterial {
    return this.standard('accent-panel', { color: ACCENT.panel, roughness: 0.36, metalness: 0.4 });
  }

  /** Warning-amber lamps and stripes shared by every faction. */
  amber(): THREE.MeshStandardMaterial {
    return this.standard('accent-amber', { color: ACCENT.hazard, emissive: ACCENT.hazard, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0 });
  }

  /**
   * A lit strip. These are the brightest thing in the scene by design: the reference reads as
   * dark machinery with light pouring out of its seams, which only works if the emissive clearly
   * outruns the lit surfaces around it.
   */
  glow(team: Team, intensity = 1.6): THREE.MeshStandardMaterial {
    const color = paletteFor(team).glow;
    // Quantised to half-steps. Every distinct intensity is a distinct material, and a material is
    // a draw call a structure's meshes cannot be merged across: the models ask for a dozen shades
    // of the same light strip, and at this range half a step of emissive is not a visible
    // difference -- it is just a few hundred draw calls in a built-up colony.
    const step = Math.max(0.5, Math.round(intensity * 2) / 2);
    return this.standard(`glow-${team}-${step}`, {
      color, emissive: color, emissiveIntensity: step * 0.38, roughness: 0.3, metalness: 0,
    });
  }

  hazard(): THREE.MeshStandardMaterial {
    return this.standard('accent-hazard', { color: ACCENT.hazard, roughness: 0.45, metalness: 0.25 });
  }

  glass(): THREE.MeshStandardMaterial {
    return this.standard('accent-glass', { color: ACCENT.glass, roughness: 0.12, metalness: 0.85 });
  }

  steel(): THREE.MeshStandardMaterial {
    return this.standard('accent-steel', { color: ACCENT.steel, roughness: 0.3, metalness: 0.6 });
  }

  copper(): THREE.MeshStandardMaterial {
    return this.standard('accent-copper', { color: ACCENT.copper, roughness: 0.35, metalness: 0.7 });
  }

  dispose(): void {
    this.surface.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}
