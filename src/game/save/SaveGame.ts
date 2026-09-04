import { BUILDINGS } from '../../data/buildings';
import { RESOURCES, STARTING_ECONOMY } from '../../data/resources';
import { UNITS } from '../../data/units';
import { AI_DIFFICULTY, DEFAULT_DIFFICULTY, type AIDifficulty } from '../../data/ai';
import { createBuildingSite } from '../entities/buildings/Building';
import { createCore } from '../entities/buildings/Core';
import { createResourceNode, type ResourceNodeEntity } from '../entities/resources/ResourceNode';
import { createUnitEntity, type EconomyScenario } from '../scenarios/economy';
import { entityId, type BuildingTypeId, type UnitTypeId } from '../types/ids';
import type { BuildingEntity, Generation, HarvestableResourceType, ResourceType, Team, UnitEntity } from '../types/simulation';

/**
 * A match, written down.
 *
 * The save is a plain description of the world, not a snapshot of the running simulation: entity
 * positions, health, stock, and progress. Everything a system can work out for itself on the next
 * tick — paths, gather and build orders, target locks, the opponent's plan, explored ground — is
 * deliberately left out, so loading a game cannot resurrect a half-finished order into a state no
 * system would ever have produced. A restored colony stands where it stood and goes back to work.
 */

export type PlayableTeam = Exclude<Team, 'neutral'>;

/** Campaign is the match against the opponent; Freestyle is the same world with nobody in it. */
export type GameMode = 'campaign' | 'freestyle';

export const SAVE_VERSION = 2;

export interface SavedUnit {
  readonly id: string;
  readonly kind: UnitTypeId;
  readonly team: PlayableTeam;
  readonly x: number;
  readonly z: number;
  readonly hp: number;
  readonly cargoType: HarvestableResourceType | null;
  readonly cargoAmount: number;
  /** Standing automation survives a save: it is a policy, not an in-flight order. */
  readonly automation: HarvestableResourceType | null;
}

export interface SavedBuilding {
  readonly id: string;
  readonly kind: BuildingTypeId;
  readonly team: PlayableTeam;
  readonly x: number;
  readonly z: number;
  readonly hp: number;
  readonly rotated: boolean;
  readonly operational: boolean;
  readonly progress: number;
  readonly queue: readonly { readonly unitType: UnitTypeId; readonly elapsed: number }[];
}

export interface SavedResource {
  readonly id: string;
  readonly type: HarvestableResourceType;
  readonly x: number;
  readonly z: number;
  readonly capacity: number;
  readonly remaining: number;
}

export interface SavedTeamState {
  readonly generation: Generation;
  readonly balances: Record<ResourceType, number>;
  readonly collected: Record<ResourceType, number>;
  readonly capacityMax: number;
  readonly capacityUsed: number;
  readonly agentsCreated: number;
  readonly buildingsConstructed: number;
  readonly stats: { unitsLost: number; unitsKilled: number; buildingsLost: number; buildingsDestroyed: number; damageDealt: number };
}

export interface SavedGame {
  readonly version: number;
  readonly savedAt: number;
  readonly mode: GameMode;
  readonly difficulty: AIDifficulty;
  readonly seed: number;
  readonly elapsedSeconds: number;
  /** Id counters, so a restored match cannot mint an id one of its own entities already holds. */
  readonly sequences: { readonly unit: number; readonly building: number };
  readonly teams: Record<PlayableTeam, SavedTeamState>;
  readonly units: readonly SavedUnit[];
  readonly buildings: readonly SavedBuilding[];
  readonly resources: readonly SavedResource[];
}

/** What the source simulation has to expose for a save to be taken of it. */
export interface SaveSource {
  readonly elapsedSeconds: number;
  readonly idSequences: { readonly unit: number; readonly building: number };
  readonly state: {
    readonly units: { all(): readonly UnitEntity[] };
    readonly buildings: { all(): readonly BuildingEntity[] };
    readonly resources: { all(): readonly ResourceNodeEntity[] };
  };
  readonly stats: { snapshot(team: PlayableTeam): SavedTeamState['stats'] };
  economy(team: Team): { readonly ledger: { snapshot(): Record<ResourceType, number>; collectedSnapshot(): Record<ResourceType, number> }; readonly capacity: { snapshot(): { used: number; max: number } } } | undefined;
  generation(team: PlayableTeam): Generation;
  agentsCreated(team: PlayableTeam): number;
  buildingsConstructed(team: PlayableTeam): number;
}

const TEAMS: readonly PlayableTeam[] = ['player', 'enemy'];

function teamState(source: SaveSource, team: PlayableTeam): SavedTeamState {
  const economy = source.economy(team);
  const capacity = economy?.capacity.snapshot() ?? { used: 0, max: 0 };
  return {
    generation: source.generation(team),
    balances: economy?.ledger.snapshot() ?? { matter: 0, energy: 0, data: 0 },
    collected: economy?.ledger.collectedSnapshot() ?? { matter: 0, energy: 0, data: 0 },
    capacityMax: capacity.max,
    // Reserved capacity is not saved: the queued orders that hold it are re-reserved on load.
    capacityUsed: capacity.used,
    agentsCreated: source.agentsCreated(team),
    buildingsConstructed: source.buildingsConstructed(team),
    stats: source.stats.snapshot(team),
  };
}

export interface SaveMeta {
  readonly mode: GameMode;
  readonly difficulty: AIDifficulty;
  readonly seed: number;
  readonly savedAt?: number;
}

/** Writes the running match down. Dead entities are dropped; nothing else is interpreted. */
export function captureSave(source: SaveSource, meta: SaveMeta): SavedGame {
  const units: SavedUnit[] = [];
  for (const unit of source.state.units.all()) {
    if (!unit.alive || unit.team === 'neutral') continue;
    units.push({
      id: unit.id, kind: unit.kind, team: unit.team,
      x: unit.position.x, z: unit.position.z, hp: unit.hp,
      cargoType: unit.cargo.type, cargoAmount: unit.cargo.amount,
      automation: unit.automation?.resourceType ?? null,
    });
  }
  const buildings: SavedBuilding[] = [];
  for (const building of source.state.buildings.all()) {
    if (!building.alive || building.team === 'neutral') continue;
    buildings.push({
      id: building.id, kind: building.kind, team: building.team,
      x: building.position.x, z: building.position.z, hp: building.hp,
      rotated: building.rotated, operational: building.operational, progress: building.constructionProgress,
      queue: building.productionQueue.map((order) => ({ unitType: order.unitType, elapsed: order.elapsed })),
    });
  }
  const resources: SavedResource[] = [];
  for (const node of source.state.resources.all()) {
    if (!node.alive) continue;
    resources.push({
      id: node.id, type: node.resourceType, x: node.position.x, z: node.position.z,
      capacity: node.capacity, remaining: node.remaining,
    });
  }
  return {
    version: SAVE_VERSION,
    savedAt: meta.savedAt ?? Date.now(),
    mode: meta.mode,
    difficulty: meta.difficulty,
    seed: meta.seed,
    elapsedSeconds: source.elapsedSeconds,
    sequences: { ...source.idSequences },
    teams: { player: teamState(source, 'player'), enemy: teamState(source, 'enemy') },
    units, buildings, resources,
  };
}

/**
 * Rebuilds the world described by a save as a scenario the simulation can be constructed from.
 *
 * Health, stock, and construction progress are restored here; economies, generations, and the
 * match clock are match-wide state and are applied afterwards by `MatchSimulation.restoreState`.
 */
export function savedScenario(save: SavedGame): EconomyScenario {
  const units: UnitEntity[] = [];
  for (const saved of save.units) {
    const unit = createUnitEntity(saved.id, saved.kind, saved.team, { x: saved.x, z: saved.z });
    unit.hp = Math.max(1, Math.min(unit.maxHp, saved.hp));
    if (saved.cargoType && saved.cargoAmount > 0) unit.cargo = { type: saved.cargoType, amount: saved.cargoAmount };
    if (saved.automation) unit.automation = { resourceType: saved.automation, searchCooldown: 0 };
    units.push(unit);
  }
  const buildings: BuildingEntity[] = [];
  for (const saved of save.buildings) {
    const id = entityId(saved.id);
    let building: BuildingEntity;
    if (saved.kind === 'core') {
      building = createCore(id, saved.team, { x: saved.x, z: saved.z });
    } else {
      // `createBuildingSite` demands a builder; the assignment is dropped immediately below.
      // A site with no builder is adopted by the nearest free Worker on the first tick, which is
      // exactly the behaviour a half-built structure wants after a load.
      building = createBuildingSite(id, saved.kind, saved.team, { x: saved.x, z: saved.z }, id, saved.rotated);
      building.builderId = null;
      building.operational = saved.operational;
      building.constructionProgress = saved.operational ? 1 : Math.max(0, Math.min(1, saved.progress));
      building.capacityApplied = saved.operational;
    }
    building.hp = Math.max(1, Math.min(building.maxHp, saved.hp));
    buildings.push(building);
  }
  const resources: ResourceNodeEntity[] = save.resources.map((saved) => {
    const node = createResourceNode(entityId(saved.id), saved.type, { x: saved.x, z: saved.z }, Math.max(1, saved.capacity));
    node.remaining = Math.max(0, Math.min(node.capacity, saved.remaining));
    return node;
  });
  return { seed: save.seed, units, buildings, resources, startingBalances: STARTING_ECONOMY };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function balances(value: unknown): Record<ResourceType, number> {
  const source = isRecord(value) ? value : {};
  return { matter: Math.max(0, finite(source.matter)), energy: Math.max(0, finite(source.energy)), data: Math.max(0, finite(source.data)) };
}

function team(value: unknown): PlayableTeam | null {
  return value === 'player' || value === 'enemy' ? value : null;
}

function resourceType(value: unknown): HarvestableResourceType | null {
  return value === 'matter' || value === 'energy' || value === 'data' ? value : null;
}

function safeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { return entityId(value); } catch { return null; }
}

function parseTeamState(value: unknown): SavedTeamState {
  const source = isRecord(value) ? value : {};
  const stats = isRecord(source.stats) ? source.stats : {};
  const generation = source.generation === 2 ? 2 : source.generation === 3 ? 3 : 1;
  return {
    generation,
    balances: balances(source.balances),
    collected: balances(source.collected),
    capacityMax: Math.max(0, finite(source.capacityMax)),
    capacityUsed: Math.max(0, finite(source.capacityUsed)),
    agentsCreated: Math.max(0, finite(source.agentsCreated)),
    buildingsConstructed: Math.max(0, finite(source.buildingsConstructed)),
    stats: {
      unitsLost: Math.max(0, finite(stats.unitsLost)),
      unitsKilled: Math.max(0, finite(stats.unitsKilled)),
      buildingsLost: Math.max(0, finite(stats.buildingsLost)),
      buildingsDestroyed: Math.max(0, finite(stats.buildingsDestroyed)),
      damageDealt: Math.max(0, finite(stats.damageDealt)),
    },
  };
}

/**
 * Reads a save back from storage.
 *
 * Anything that arrives here has been sitting in the browser, where it can be edited, truncated,
 * or left behind by an older build, so every field is checked and an entity that does not
 * describe something the game can actually build is dropped rather than trusted. A save with no
 * Core for a faction that should have one is rejected outright: there is no match to resume.
 */
export function parseSave(value: unknown): SavedGame | null {
  if (!isRecord(value) || value.version !== SAVE_VERSION) return null;
  const mode: GameMode = value.mode === 'freestyle' ? 'freestyle' : 'campaign';
  const difficulty = typeof value.difficulty === 'string' && value.difficulty in AI_DIFFICULTY
    ? value.difficulty as AIDifficulty
    : DEFAULT_DIFFICULTY;
  const seen = new Set<string>();
  const units: SavedUnit[] = [];
  for (const raw of Array.isArray(value.units) ? value.units : []) {
    if (!isRecord(raw)) continue;
    const id = safeId(raw.id);
    const owner = team(raw.team);
    const kind = typeof raw.kind === 'string' && raw.kind in UNITS ? raw.kind as UnitTypeId : null;
    if (!id || !owner || !kind || seen.has(id)) continue;
    seen.add(id);
    units.push({
      id, kind, team: owner, x: finite(raw.x), z: finite(raw.z),
      hp: Math.max(1, finite(raw.hp, UNITS[kind].maxHp)),
      cargoType: resourceType(raw.cargoType), cargoAmount: Math.max(0, finite(raw.cargoAmount)),
      automation: resourceType(raw.automation),
    });
  }
  const buildings: SavedBuilding[] = [];
  for (const raw of Array.isArray(value.buildings) ? value.buildings : []) {
    if (!isRecord(raw)) continue;
    const id = safeId(raw.id);
    const owner = team(raw.team);
    const kind = typeof raw.kind === 'string' && raw.kind in BUILDINGS ? raw.kind as BuildingTypeId : null;
    if (!id || !owner || !kind || seen.has(id)) continue;
    seen.add(id);
    const queue: { unitType: UnitTypeId; elapsed: number }[] = [];
    for (const order of Array.isArray(raw.queue) ? raw.queue : []) {
      if (!isRecord(order)) continue;
      const unitType = typeof order.unitType === 'string' && order.unitType in UNITS ? order.unitType as UnitTypeId : null;
      if (unitType) queue.push({ unitType, elapsed: Math.max(0, finite(order.elapsed)) });
    }
    buildings.push({
      id, kind, team: owner, x: finite(raw.x), z: finite(raw.z),
      hp: Math.max(1, finite(raw.hp, BUILDINGS[kind].maxHp)),
      rotated: raw.rotated === true,
      operational: kind === 'core' || raw.operational === true,
      progress: Math.max(0, Math.min(1, finite(raw.progress, 1))),
      queue,
    });
  }
  const resources: SavedResource[] = [];
  for (const raw of Array.isArray(value.resources) ? value.resources : []) {
    if (!isRecord(raw)) continue;
    const id = safeId(raw.id);
    const type = resourceType(raw.type);
    if (!id || !type || seen.has(id)) continue;
    seen.add(id);
    const capacity = Math.max(1, finite(raw.capacity, RESOURCES[type].capacity));
    resources.push({ id, type, x: finite(raw.x), z: finite(raw.z), capacity, remaining: Math.max(0, Math.min(capacity, finite(raw.remaining, capacity))) });
  }
  if (!buildings.some((building) => building.kind === 'core' && building.team === 'player')) return null;
  if (mode === 'campaign' && !buildings.some((building) => building.kind === 'core' && building.team === 'enemy')) return null;
  const teams = isRecord(value.teams) ? value.teams : {};
  const sequences = isRecord(value.sequences) ? value.sequences : {};
  return {
    version: SAVE_VERSION,
    savedAt: finite(value.savedAt, Date.now()),
    mode,
    difficulty,
    seed: Math.max(1, Math.floor(finite(value.seed, 1))),
    elapsedSeconds: Math.max(0, finite(value.elapsedSeconds)),
    sequences: { unit: Math.max(1, Math.floor(finite(sequences.unit, 1))), building: Math.max(1, Math.floor(finite(sequences.building, 1))) },
    teams: { player: parseTeamState(teams.player), enemy: parseTeamState(teams.enemy) },
    units, buildings, resources,
  };
}

/** The line the menu shows on the CONTINUE button. */
export function describeSave(save: SavedGame): string {
  const minutes = Math.floor(save.elapsedSeconds / 60);
  const seconds = Math.floor(save.elapsedSeconds % 60).toString().padStart(2, '0');
  const label = save.mode === 'freestyle' ? 'FREESTYLE' : AI_DIFFICULTY[save.difficulty].label.toUpperCase();
  return `${label} · ${minutes}:${seconds} · GEN ${save.teams.player.generation}`;
}

export { TEAMS as SAVED_TEAMS };
