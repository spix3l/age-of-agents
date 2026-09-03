import { create } from 'zustand';
import type { ScreenRect } from '../game/systems/SelectionSystem';
import type { PlaceableBuildingType } from '../game/building/PlacementController';
import type { EntityId, UnitTypeId } from '../game/types/ids';
import type { Generation, HarvestableResourceType } from '../game/types/simulation';
import type { MatchResult } from '../game/match/MatchState';
import { DEFAULT_DIFFICULTY, type AIDifficulty } from '../data/ai';

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
}

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
  productionRequest: (() => void) | null;
  buildRequest: ((type: PlaceableBuildingType) => void) | null;
  automationRequest: ((type: HarvestableResourceType) => void) | null;
  unitProductionRequest: ((type: UnitTypeId) => void) | null;
  cancelProductionRequest: ((id: EntityId) => void) | null;
  cancelConstructionRequest: (() => void) | null;
  advanceGenerationRequest: (() => void) | null;
  audioToggleRequest: (() => void) | null;
  audioMuted: boolean;
  audioVolume: number;
  audioVolumeRequest: ((volume: number) => void) | null;
  placementMode: PlaceableBuildingType | null;
  matchResult: MatchResult | null;
  matchSummary: MatchSummary;
  matchNonce: number;
  menuOpen: boolean;
  helpOpen: boolean;
  difficulty: AIDifficulty;
  setDifficulty: (difficulty: AIDifficulty) => void;
  setHelpOpen: (open: boolean) => void;
  startMatch: () => void;
  returnToMenu: () => void;
  debugVisible: boolean;
  debug: DebugSnapshot;
  setDebugSnapshot: (debug: DebugSnapshot) => void;
  toggleDebug: () => void;
  setMatchOutcome: (result: MatchResult, summary: MatchSummary) => void;
  restartMatch: () => void;
  setEconomySnapshot: (snapshot: Pick<UiState, 'matter' | 'energy' | 'data' | 'generation' | 'capacityUsed' | 'capacityReserved' | 'capacityMax' | 'totalUnits' | 'selection' | 'selectedCount' | 'queue'>) => void;
  setSelectionBox: (rect: ScreenRect | null) => void;
  setLastOrder: (order: string) => void;
  setProductionRequest: (request: (() => void) | null) => void;
  setBuildRequest: (request: ((type: PlaceableBuildingType) => void) | null) => void;
  setAutomationRequest: (request: ((type: HarvestableResourceType) => void) | null) => void;
  setUnitProductionRequest: (request: ((type: UnitTypeId) => void) | null) => void;
  setCancelProductionRequest: (request: ((id: EntityId) => void) | null) => void;
  setCancelConstructionRequest: (request: (() => void) | null) => void;
  setAdvanceGenerationRequest: (request: (() => void) | null) => void;
  setAudioToggleRequest: (request: (() => void) | null, muted?: boolean) => void;
  setAudioVolumeRequest: (request: ((volume: number) => void) | null, volume?: number) => void;
  setPlacementMode: (type: PlaceableBuildingType | null) => void;
  produceWorker: () => void;
  beginBuild: (type: PlaceableBuildingType) => void;
  automate: (type: HarvestableResourceType) => void;
  produceUnit: (type: UnitTypeId) => void;
  cancelProduction: (id: EntityId) => void;
  cancelConstruction: () => void;
  advanceGeneration: () => void;
  toggleAudio: () => void;
  setAudioVolume: (volume: number) => void;
}

const EMPTY_SELECTION: SelectionSnapshot = { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false, canBuild: false };

export const useUiStore = create<UiState>((set, get) => ({
  matter: 0, energy: 0, data: 0, generation: 1, capacityUsed: 0, capacityReserved: 0, capacityMax: 0,
  selectedCount: 0, totalUnits: 0, selection: EMPTY_SELECTION,
  queue: { count: 0, progress: 0, label: 'QUEUE EMPTY', items: [] },
  selectionBox: null, lastOrder: 'AWAITING COMMAND', matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY, matchNonce: 0,
  menuOpen: true, helpOpen: false, difficulty: DEFAULT_DIFFICULTY, debugVisible: false, debug: EMPTY_DEBUG, productionRequest: null, buildRequest: null, automationRequest: null, unitProductionRequest: null, cancelProductionRequest: null, cancelConstructionRequest: null, advanceGenerationRequest: null, audioToggleRequest: null, audioVolumeRequest: null, audioMuted: false, audioVolume: 0.66, placementMode: null,
  setEconomySnapshot: (snapshot) => set(snapshot),
  setDifficulty: (difficulty) => set({ difficulty }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  startMatch: () => set((state) => ({
    menuOpen: false, helpOpen: false, matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY,
    matchNonce: state.matchNonce + 1, lastOrder: 'COLONY ONLINE // AWAITING COMMAND',
    selectionBox: null, placementMode: null,
  })),
  returnToMenu: () => set({ menuOpen: true, helpOpen: false, matchResult: null, selectionBox: null, placementMode: null }),
  setDebugSnapshot: (debug) => set({ debug }),
  toggleDebug: () => set((state) => ({ debugVisible: !state.debugVisible })),
  setMatchOutcome: (matchResult, matchSummary) => set({ matchResult, matchSummary }),
  restartMatch: () => set((state) => ({
    matchResult: null, matchSummary: EMPTY_MATCH_SUMMARY, matchNonce: state.matchNonce + 1,
    lastOrder: 'NEW MATCH // AWAITING COMMAND', selectionBox: null, placementMode: null,
  })),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  setLastOrder: (lastOrder) => set({ lastOrder }),
  setProductionRequest: (productionRequest) => set({ productionRequest }),
  setBuildRequest: (buildRequest) => set({ buildRequest }),
  setAutomationRequest: (automationRequest) => set({ automationRequest }),
  setUnitProductionRequest: (unitProductionRequest) => set({ unitProductionRequest }),
  setCancelProductionRequest: (cancelProductionRequest) => set({ cancelProductionRequest }),
  setCancelConstructionRequest: (cancelConstructionRequest) => set({ cancelConstructionRequest }),
  setAdvanceGenerationRequest: (advanceGenerationRequest) => set({ advanceGenerationRequest }),
  setAudioToggleRequest: (audioToggleRequest, audioMuted) => set((state) => ({ audioToggleRequest, audioMuted: audioMuted ?? state.audioMuted })),
  setAudioVolumeRequest: (audioVolumeRequest, audioVolume) => set((state) => ({ audioVolumeRequest, audioVolume: audioVolume ?? state.audioVolume })),
  setPlacementMode: (placementMode) => set({ placementMode }),
  produceWorker: () => get().productionRequest?.(),
  beginBuild: (type) => get().buildRequest?.(type),
  automate: (type) => get().automationRequest?.(type),
  produceUnit: (type) => get().unitProductionRequest?.(type),
  cancelProduction: (id) => get().cancelProductionRequest?.(id),
  cancelConstruction: () => get().cancelConstructionRequest?.(),
  advanceGeneration: () => get().advanceGenerationRequest?.(),
  toggleAudio: () => get().audioToggleRequest?.(),
  setAudioVolume: (volume) => get().audioVolumeRequest?.(volume),
}));
