import { create } from 'zustand';
import type { ScreenRect } from '../game/systems/SelectionSystem';
import type { PlaceableBuildingType } from '../game/building/PlacementController';

export interface SelectionSnapshot {
  readonly type: 'unit' | 'building' | 'resource' | 'group' | 'none';
  readonly name: string;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly activity: string;
  readonly detail?: string;
  readonly isPlayerCore: boolean;
  readonly canBuild: boolean;
}

export interface QueueSnapshot { readonly count: number; readonly progress: number; readonly label: string }

interface UiState {
  matter: number;
  energy: number;
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
  placementMode: PlaceableBuildingType | null;
  setEconomySnapshot: (snapshot: Pick<UiState, 'matter' | 'energy' | 'capacityUsed' | 'capacityReserved' | 'capacityMax' | 'totalUnits' | 'selection' | 'selectedCount' | 'queue'>) => void;
  setSelectionBox: (rect: ScreenRect | null) => void;
  setLastOrder: (order: string) => void;
  setProductionRequest: (request: (() => void) | null) => void;
  setBuildRequest: (request: ((type: PlaceableBuildingType) => void) | null) => void;
  setPlacementMode: (type: PlaceableBuildingType | null) => void;
  produceWorker: () => void;
  beginBuild: (type: PlaceableBuildingType) => void;
}

const EMPTY_SELECTION: SelectionSnapshot = { type: 'none', name: 'NO SELECTION', activity: 'Select a Worker, Core, or resource node', isPlayerCore: false, canBuild: false };

export const useUiStore = create<UiState>((set, get) => ({
  matter: 0, energy: 0, capacityUsed: 0, capacityReserved: 0, capacityMax: 0,
  selectedCount: 0, totalUnits: 0, selection: EMPTY_SELECTION,
  queue: { count: 0, progress: 0, label: 'QUEUE EMPTY' },
  selectionBox: null, lastOrder: 'AWAITING COMMAND', productionRequest: null, buildRequest: null, placementMode: null,
  setEconomySnapshot: (snapshot) => set(snapshot),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  setLastOrder: (lastOrder) => set({ lastOrder }),
  setProductionRequest: (productionRequest) => set({ productionRequest }),
  setBuildRequest: (buildRequest) => set({ buildRequest }),
  setPlacementMode: (placementMode) => set({ placementMode }),
  produceWorker: () => get().productionRequest?.(),
  beginBuild: (type) => get().buildRequest?.(type),
}));
