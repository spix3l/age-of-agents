import type { ScreenPoint, ScreenRect } from '../systems/SelectionSystem';

interface InputCallbacks {
  readonly selectPoint: (point: ScreenPoint, additive: boolean) => void;
  readonly selectBox: (rect: ScreenRect, additive: boolean) => void;
  readonly move: (point: ScreenPoint) => void;
  readonly selectionBox: (rect: ScreenRect | null) => void;
  readonly hover?: (point: ScreenPoint) => void;
  readonly primaryAction?: (point: ScreenPoint) => boolean;
  readonly cancelAction?: () => boolean;
  readonly toggleDebug?: () => void;
}

export class InputManager {
  private dragStart: ScreenPoint | null = null;
  private dragCurrent: ScreenPoint | null = null;
  private readonly dragThreshold = 6;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly callbacks: InputCallbacks) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    globalThis.addEventListener('keydown', this.onKeyDown);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    globalThis.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragCurrent = this.dragStart;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.callbacks.hover?.({ x: event.clientX, y: event.clientY });
    if (!this.dragStart) return;
    this.dragCurrent = { x: event.clientX, y: event.clientY };
    if (this.distance() >= this.dragThreshold) this.callbacks.selectionBox(this.rect());
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.dragStart) return;
    this.dragCurrent = { x: event.clientX, y: event.clientY };
    if (this.callbacks.primaryAction?.(this.dragCurrent)) { /* placement handled */ }
    else if (this.distance() >= this.dragThreshold) this.callbacks.selectBox(this.rect(), event.shiftKey);
    else this.callbacks.selectPoint(this.dragCurrent, event.shiftKey);
    this.dragStart = null; this.dragCurrent = null;
    this.callbacks.selectionBox(null);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.callbacks.cancelAction?.()) return;
    this.callbacks.move({ x: event.clientX, y: event.clientY });
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.callbacks.cancelAction?.()) event.preventDefault();
    if (event.key === 'F3') {
      event.preventDefault();
      this.callbacks.toggleDebug?.();
    }
  };

  private readonly onPointerCancel = (): void => {
    this.dragStart = null;
    this.dragCurrent = null;
    this.callbacks.selectionBox(null);
  };

  private distance(): number {
    if (!this.dragStart || !this.dragCurrent) return 0;
    return Math.hypot(this.dragCurrent.x - this.dragStart.x, this.dragCurrent.y - this.dragStart.y);
  }

  private rect(): ScreenRect {
    const start = this.dragStart!; const current = this.dragCurrent!;
    return { left: Math.min(start.x, current.x), top: Math.min(start.y, current.y), right: Math.max(start.x, current.x), bottom: Math.max(start.y, current.y) };
  }
}
