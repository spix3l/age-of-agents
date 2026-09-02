import { create } from 'zustand';
import type { ScreenRect } from '../game/systems/SelectionSystem';

interface UiState {
  selectedCount: number;
  totalUnits: number;
  selectionBox: ScreenRect | null;
  lastOrder: string;
  setSelectedCount: (count: number) => void;
  setTotalUnits: (count: number) => void;
  setSelectionBox: (rect: ScreenRect | null) => void;
  setLastOrder: (order: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedCount: 0,
  totalUnits: 0,
  selectionBox: null,
  lastOrder: 'AWAITING COMMAND',
  setSelectedCount: (selectedCount) => set({ selectedCount }),
  setTotalUnits: (totalUnits) => set({ totalUnits }),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  setLastOrder: (lastOrder) => set({ lastOrder }),
}));
