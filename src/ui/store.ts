import { create } from 'zustand';
import type { ScreenRect } from '../game/systems/SelectionSystem';
import type { PlaceableBuildingType } from '../game/building/PlacementController';
import type { EntityId, UnitTypeId } from '../game/types/ids';
import type { Generation, HarvestableResourceType } from '../game/types/simulation';
import type { MatchResult } from '../game/match/MatchState';
import { DEFAULT_DIFFICULTY, type AIDifficulty } from '../data/ai';
import type { GameMode, SavedGame } from '../game/save/SaveGame';
import { clearSave, readSave } from '../game/save/saveStorage';

export interface MatchSummary {
  readonly durationSeconds: number;
  readonly matterCollected: number;
  readonly energyCollected: number;
  readonly dataCollected: number;
  readonly agentsCreated: number;
  readonly agentsKilled: number;
  readonly agentsLost: number;
  readonly buildingsDestroyed: number;
  readonly buildingsLost: number;
  readonly buildingsConstructed: number;
  readonly finalGeneration: Generation;
}

export interface DebugSnapshot {
  readonly fps: number;
  readonly units: number;
  readonly buildings: number;
  readonly elapsedSeconds: number;
  readonly aiState: string;
  readonly aiReason: string;
  readonly aiWorkers: number;
  readonly aiArmy: number;
  readonly aiAssault: number;
  readonly aiMatter: number;
  readonly aiEnergy: number;
  readonly aiCapacity: string;
  readonly aiCoreKnown: boolean;
  readonly effectsActive: number;
  readonly effectsPooled: number;
}

export const EMPTY_DEBUG: DebugSnapshot = {
  fps: 0, units: 0, buildings: 0, elapsedSeconds: 0, aiState: 'OFFLINE', aiReason: '—',
  aiWorkers: 0, aiArmy: 0, aiAssault: 0, aiMatter: 0, aiEnergy: 0, aiCapacity: '0/0',
  aiCoreKnown: false, effectsActive: 0, effectsPooled: 0,
};

export const EMPTY_MATCH_SUMMARY: MatchSummary = {
  durationSeconds: 0, matterCollected: 0, energyCollected: 0, dataCollected: 0, agentsCreated: 0,
  agentsKilled: 0, agentsLost: 0, buildingsDestroyed: 0, buildingsLost: 0, buildingsConstructed: 0, finalGeneration: 1,
};

export interface SelectionSnapshot {
  readonly type: 'unit' | 'building' | 'resource' | 'group' | 'none';
  readonly name: string;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly activity: string;
  readonly detail?: string;
  readonly isPlayerCore: boolean;
  readonly canBuild: boolean;
  readonly producer?: readonly UnitTypeId[] | null;
  readonly constructionSite?: boolean;
  /** A completed player structure other than the Core, which can be picked up and set down. */
  readonly canRelocate?: boolean;
}

/** One dot on the minimap. Kept deliberately small: this ships at 10 Hz for every visible entity. */
export interface MinimapBlip {
  readonly x: number;
  readonly z: number;
  /** `own` and `ally` draw in faction colour, `hostile` in the enemy's, `resource` by type. */
  readonly kind: 'own' | 'hostile' | 'matter' | 'energy' | 'data';
  readonly building: boolean;
}

export interface MinimapSnapshot {
  readonly blips: readonly MinimapBlip[];
  /** Explored/visible mask, one byte per vision cell, row-major from the map's min corner. */
  readonly fog: Uint8Array;
  readonly fogWidth: number;
  readonly fogHeight: number;
  /** The camera's ground focus, so the viewport marker can be drawn. */
  readonly focusX: number;
  readonly focusZ: number;
  /** Half-extent of the visible ground footprint, in world units. */
  readonly viewHalf: number;
}

export const EMPTY_MINIMAP: MinimapSnapshot = {
  blips: [], fog: new Uint8Array(0), fogWidth: 0, fogHeight: 0, focusX: 0, focusZ: 0, viewHalf: 40,
};

export interface QueueSnapshot { readonly count: number; readonly progress: number; readonly label: string; readonly items: readonly { readonly id: EntityId; readonly unitType: UnitTypeId; readonly label: string }[] }

interface UiState {
  matter: number;
  energy: number;
  data: number;
  generation: Generation;
  capacityUsed: number;
  capacityReserved: number;
  capacityMax: number;
  selectedCount: number;
  totalUnits: number;
  selection: SelectionSnapshot;
  queue: QueueSnapshot;
  selectionBox: ScreenRect | null;
  lastOrder: string;
  minimap: MinimapSnapshot;
  /** Income over the last sampling window, per second, for the resource bar. */
  income: { readonly matter: number; readonly energy: number; readonly data: number };
  setMinimap: (minimap: MinimapSnapshot) => void;
  minimapJumpRequest: ((x: number, z: number) => void) | null;
  setMinimapJumpRequest: (request: ((x: number, z: number) => void) | null) => void;
  jumpTo: (x: number, z: number) => void;
  productionRequest: (() => void) | null;
  buildRequest: ((type: PlaceableBuildingType) => void) | null;
  automationRequest: ((type: HarvestableResourceType) => void) | null;
  unitProductionRequest: ((type: UnitTypeId) => void) | null;
  cancelProductionRequest: ((id: EntityId) => void) | null;
  cancelConstructionRequest: (() => void) | null;
  relocateRequest: (() => void) | null;
  advanceGenerationRequest: (() => void) | null;
  audioToggleRequest: (() => void) | null;
  audioMuted: boolean;
  audioVolume: number;
  audioVolumeRequest: ((volume: number) => void) | null;
  placementMode: PlaceableBuildingType | null;
  /** True while the armed placement tool is re-seating an existing structure, not buying a new one. */
  relocating: boolean;
  matchResult: MatchResult | null;
  matchSummary: MatchSummary;
  matchNonce: number;
  /** This match's seed. Drawn fresh per match, so the map and the opponent differ every game. */
  matchSeed: number;
  menuOpen: boolean;
  helpOpen: boolean;
  difficulty: AIDifficulty;
  /** Campaign is the match against the opponent; Freestyle is the map with nobody else on it. */
  mode: GameMode;
  /** True while the match is held. The loop reads it; everything else keeps rendering. */
  paused: boolean;
  /** The save the next match should resume, handed to `Game` when it is constructed. */
  pendingSave: SavedGame | null;
  /** What is in the save slot right now, so the menu knows whether to offer CONTINUE. */
  savedGame: SavedGame | null;
  /** Transient result of the last save attempt, shown in the pause menu. */
  saveNote: string | null;
  saveRequest: (() => boolean) | null;
  setDifficulty: (difficulty: AIDifficulty) => void;
  setMode: (mode: GameMode) => void;
  setHelpOpen: (open: boolean) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  setSaveRequest: (request: (() => boolean) | null) => void;
  saveGame: () => void;
  refreshSavedGame: () => void;
  continueSavedGame: () => void;
  discardSavedGame: () => void;
  startMatch: (mode?: GameMode) => void;
  returnToMenu: () => void;
  debugVisible: boolean;
  debug: DebugSnapshot;
  setDebugSnapshot: (debug: DebugSnapshot) => void;
  toggleDebug: () => void;
  setMatchOutcome: (result: MatchResult, summary: MatchSummary) => void;
  restartMatch: () => void;
  setEconomySnapshot: (snapshot: Pick<UiState, 'matter' | 'energy' | 'data' | 'generation' | 'capacityUsed' | 'capacityReserved' | 'capacityMax' | 'totalUnits' | 'selection' | 'selectedCount' | 'queue' | 'income'>) => void;
  setSelectionBox: (rect: ScreenRect | null) => void;
  setLastOrder: (order: string) => void;
  setProductionRequest: (request: (() => void) | null) => void;
  setBuildRequest: (request: ((type: PlaceableBuildingType) => void) | null) => void;
  setAutomationRequest: (request: ((type: HarvestableResourceType) => void) | null) => void;
  setUnitProductionRequest: (request: ((type: UnitTypeId) => void) | null) => void;
  setCancelProductionRequest: (request: ((id: EntityId) => void) | null) => void;
  setCancelConstructionRequest: (request: (() => void) | null) => void;
  setRelocateRequest: (request: (() => void) | null) => void;
  setAdvanceGenerationRequest: (request: (() => void) | null) => void;
  setAudioToggleRequest: (request: (() => void) | null, muted?: boolean) => void;
  setAudioVolumeRequest: (request: ((volume: number) => void) | null, volume?: number) => void;
  setPlacementMode: (type: PlaceableBuildingType | null, relocating?: boolean) => void;
  produceWorker: () => void;
  beginBuild: (type: PlaceableBuildingType) => void;
  automate: (type: HarvestableResourceType) => void;
  produceUnit: (type: UnitTypeId) => void;
  cancelProduction: (id: EntityId) => void;
  cancelConstruction: () => void;
  beginRelocate: () => void;
  advanceGeneration: () => void;
  toggleAudio: () => void;
  setAudioVolume: (volume: number) => void;
}

/**
 * A fresh seed per match. Nothing was passing one, so every game ran the scenario generator's and
 * the opponent's default seeds: the same map, in the same places, opened the same way, every time.
 */
function newSeed(): number {
  return Math.floor(Math.random() * 0x7fff_ffff) + 1;
}

const EMPTY_SELECTION: SelectionSnapshot = { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false, canBuild: false };

export const useUiStore = create<UiState>((set, get) => ({
  matter: 0, energy: 0, data: 0, generation: 1, capacityUsed: 0, capacityReserved: 0, capacityMax: 0,
  selectedCount: 0, totalUnits: 0, selection: EMPTY_SELECTION,
  queue: { count: 0, progress: 0, label: 'QUEUE EMPTY', items: [] },
  minimap: EMPTY_MINIMAP, income: { matter: 0, energy: 0, data: 0 }, minimapJumpRequest: null,
  matchSeed: newSeed(),
  selectionBox: null, lastOrder: 'AWAITING COMMAND', matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY, matchNonce: 0,
  menuOpen: true, helpOpen: false, difficulty: DEFAULT_DIFFICULTY, mode: 'campaign',
  paused: false, pendingSave: null, savedGame: readSave(), saveNote: null, saveRequest: null,
  debugVisible: false, debug: EMPTY_DEBUG, productionRequest: null, buildRequest: null, automationRequest: null, unitProductionRequest: null, cancelProductionRequest: null, cancelConstructionRequest: null, relocateRequest: null, advanceGenerationRequest: null, audioToggleRequest: null, audioVolumeRequest: null, audioMuted: false, audioVolume: 0.66, placementMode: null, relocating: false,
  setEconomySnapshot: (snapshot) => set(snapshot),
  setDifficulty: (difficulty) => set({ difficulty }),
  setMode: (mode) => set({ mode }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setPaused: (paused) => set({ paused, saveNote: null }),
  // Pausing is refused outside a live match: there is nothing to hold, and a stuck `paused`
  // would freeze the next match before its first tick.
  togglePause: () => set((state) => (state.menuOpen || state.matchResult ? {} : { paused: !state.paused, saveNote: null })),
  setSaveRequest: (saveRequest) => set({ saveRequest }),
  saveGame: () => {
    const saved = get().saveRequest?.() ?? false;
    set({ saveNote: saved ? 'MATCH SAVED' : 'SAVE FAILED // STORAGE UNAVAILABLE', savedGame: saved ? readSave() : get().savedGame });
  },
  refreshSavedGame: () => set({ savedGame: readSave() }),
  continueSavedGame: () => {
    const save = readSave();
    if (!save) { set({ savedGame: null }); return; }
    set((state) => ({
      savedGame: save, pendingSave: save, mode: save.mode, difficulty: save.difficulty, matchSeed: save.seed,
      menuOpen: false, helpOpen: false, paused: false, saveNote: null,
      matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY, matchNonce: state.matchNonce + 1,
      lastOrder: 'COLONY RESTORED // AWAITING COMMAND',
      selectionBox: null, placementMode: null, relocating: false, minimap: EMPTY_MINIMAP,
    }));
  },
  discardSavedGame: () => { clearSave(); set({ savedGame: null, pendingSave: null }); },
  startMatch: (mode) => set((state) => ({
    menuOpen: false, helpOpen: false, matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY,
    matchNonce: state.matchNonce + 1, lastOrder: 'COLONY ONLINE // AWAITING COMMAND',
    selectionBox: null, placementMode: null, relocating: false, minimap: EMPTY_MINIMAP, matchSeed: newSeed(),
    mode: mode ?? state.mode, paused: false, pendingSave: null, saveNote: null,
  })),
  returnToMenu: () => set({
    menuOpen: true, helpOpen: false, matchResult: null, selectionBox: null, placementMode: null,
    relocating: false, paused: false, pendingSave: null, saveNote: null, savedGame: readSave(),
  }),
  setDebugSnapshot: (debug) => set({ debug }),
  toggleDebug: () => set((state) => ({ debugVisible: !state.debugVisible })),
  setMatchOutcome: (matchResult, matchSummary) => set({ matchResult, matchSummary }),
  restartMatch: () => set((state) => ({
    matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY, matchNonce: state.matchNonce + 1,
    lastOrder: 'NEW MATCH // AWAITING COMMAND', selectionBox: null, placementMode: null, relocating: false, minimap: EMPTY_MINIMAP,
    matchSeed: newSeed(), paused: false, pendingSave: null, saveNote: null,
  })),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  setMinimap: (minimap) => set({ minimap }),
  setMinimapJumpRequest: (minimapJumpRequest) => set({ minimapJumpRequest }),
  jumpTo: (x, z) => get().minimapJumpRequest?.(x, z),
  setLastOrder: (lastOrder) => set({ lastOrder }),
  setProductionRequest: (productionRequest) => set({ productionRequest }),
  setBuildRequest: (buildRequest) => set({ buildRequest }),
  setAutomationRequest: (automationRequest) => set({ automationRequest }),
  setUnitProductionRequest: (unitProductionRequest) => set({ unitProductionRequest }),
  setCancelProductionRequest: (cancelProductionRequest) => set({ cancelProductionRequest }),
  setCancelConstructionRequest: (cancelConstructionRequest) => set({ cancelConstructionRequest }),
  setRelocateRequest: (relocateRequest) => set({ relocateRequest }),
  setAdvanceGenerationRequest: (advanceGenerationRequest) => set({ advanceGenerationRequest }),
  setAudioToggleRequest: (audioToggleRequest, audioMuted) => set((state) => ({ audioToggleRequest, audioMuted: audioMuted ?? state.audioMuted })),
  setAudioVolumeRequest: (audioVolumeRequest, audioVolume) => set((state) => ({ audioVolumeRequest, audioVolume: audioVolume ?? state.audioVolume })),
  setPlacementMode: (placementMode, relocating = false) => set({ placementMode, relocating: placementMode === null ? false : relocating }),
  produceWorker: () => get().productionRequest?.(),
  beginBuild: (type) => get().buildRequest?.(type),
  automate: (type) => get().automationRequest?.(type),
  produceUnit: (type) => get().unitProductionRequest?.(type),
  cancelProduction: (id) => get().cancelProductionRequest?.(id),
  cancelConstruction: () => get().cancelConstructionRequest?.(),
  beginRelocate: () => get().relocateRequest?.(),
  advanceGeneration: () => get().advanceGenerationRequest?.(),
  toggleAudio: () => get().audioToggleRequest?.(),
  setAudioVolume: (volume) => get().audioVolumeRequest?.(volume),
}));
