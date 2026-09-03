import * as THREE from 'three';
import manifest from '../../art/models.json';
import { ResourceCache } from '../game/rendering/models/palette';
import { buildBuildingModel } from '../game/rendering/models/buildings';
import { buildUnitModel } from '../game/rendering/models/units';
import { buildResourceModel } from '../game/rendering/models/resources';
import { GENERATED_MODELS } from '../game/rendering/models/generated';
import type { BuildingTypeId, UnitTypeId } from '../game/types/ids';
import type { HarvestableResourceType } from '../game/types/simulation';

/** Every crop `art/extract_models.py` writes, with the band it was sliced from. */
interface ManifestEntry {
  readonly name: string;
  readonly band: string;
  readonly file: string;
  readonly box: readonly number[];
}

const REFERENCE_URLS = import.meta.glob('../../art/models/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Human-readable section per extraction band, in the order the lab lists them. */
const SECTIONS: readonly (readonly [prefix: string, label: string])[] = [
  ['core', 'Core & Economy'],
  ['economy', 'Core & Economy'],
  ['production', 'Production Buildings'],
  ['defense', 'Defense'],
  ['special', 'Special Structures'],
  ['units-economy', 'Units — Economy'],
  ['units-combat', 'Units — Combat'],
  ['resources', 'Resources'],
  ['effects', 'Effects & UI'],
];

/**
 * Crops the game already has a hand-written model for. The lab shows those side by side with the
 * reference so the existing art can be judged against the sheet it was drawn from.
 */
const IN_GAME_BUILDINGS: Readonly<Record<string, BuildingTypeId>> = {
  core: 'core',
  'relay-node': 'relay',
  fabricator: 'fabricator',
  'supply-depot': 'depot',
  'heavy-foundry': 'foundry',
  'defense-turret': 'turret',
  'wall-segment': 'wall',
  'command-center': 'outpost',
};
const IN_GAME_UNITS: Readonly<Record<string, UnitTypeId>> = {
  'worker-agent': 'worker',
  'worker-agent-alt': 'worker',
  striker: 'striker',
  ranger: 'ranger',
  'scout-drone': 'scout',
  titan: 'titan',
};
const IN_GAME_RESOURCES: Readonly<Record<string, HarvestableResourceType>> = {
  matter: 'matter',
  energy: 'energy',
  data: 'data',
};

export type ModelSource = 'generated' | 'in-game' | 'none';

export interface ModelEntry {
  readonly id: string;
  /** "worker-agent-tier-3" reads as "Worker Agent Tier 3" in the sidebar. */
  readonly label: string;
  readonly section: string;
  readonly referenceUrl: string;
  readonly source: ModelSource;
  /** Builds the 3D preview, or null when only the reference image exists so far. */
  readonly build: ((cache: ResourceCache) => THREE.Group) | null;
}

function labelFor(name: string): string {
  return name
    .split('-')
    .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function sectionFor(band: string): string {
  for (const [prefix, label] of SECTIONS) {
    if (band === prefix || band.startsWith(`${prefix}-`)) return label;
  }
  return 'Other';
}

function inGameBuilder(name: string): ((cache: ResourceCache) => THREE.Group) | null {
  const building = IN_GAME_BUILDINGS[name];
  if (building) return (cache) => buildBuildingModel(cache, building, 'player', 'lab').group;
  const unit = IN_GAME_UNITS[name];
  if (unit) return (cache) => buildUnitModel(cache, unit, 'player', 'lab').group;
  const resource = IN_GAME_RESOURCES[name];
  if (resource) return (cache) => buildResourceModel(cache, resource, 'lab').group;
  return null;
}

function entryFor(item: ManifestEntry): ModelEntry {
  const generated = GENERATED_MODELS[item.name];
  const inGame = generated ? null : inGameBuilder(item.name);
  const build = generated ? () => generated() : inGame;
  return {
    id: item.name,
    label: labelFor(item.name),
    section: sectionFor(item.band),
    referenceUrl: REFERENCE_URLS[`../../art/models/${item.name}.png`] ?? '',
    source: generated ? 'generated' : inGame ? 'in-game' : 'none',
    build,
  };
}

export const MODELS: readonly ModelEntry[] = (manifest as ManifestEntry[]).map(entryFor);

const ORDER = SECTIONS.map(([, label]) => label).filter((label, i, all) => all.indexOf(label) === i);

/** The sidebar groups, in sheet order, each holding the crops sliced from that part of the sheet. */
export const SECTIONS_IN_ORDER: readonly { section: string; models: readonly ModelEntry[] }[] =
  [...new Set(MODELS.map((m) => m.section))]
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map((section) => ({ section, models: MODELS.filter((m) => m.section === section) }));

export function findModel(id: string | null): ModelEntry {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]!;
}
