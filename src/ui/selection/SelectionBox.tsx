import { useUiStore } from '../store';

export function SelectionBox() {
  const rect = useUiStore((state) => state.selectionBox);
  if (!rect) return null;
  return <div className="selection-box" style={{ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }} />;
}
