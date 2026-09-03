import * as THREE from 'three';
import { MAP_BOUNDS, START_POSITIONS } from '../world/map';

// Equal X/Y/Z offsets produce the classic orthographic isometric elevation:
// atan(1 / sqrt(2)) = ~35.3 degrees above the ground plane.
const CAMERA_OFFSET = new THREE.Vector3(32, 32, 32);

export type PanDirection = 'up' | 'down' | 'left' | 'right';

export function panDirectionForKey(key: string): PanDirection | null {
  switch (key.toLowerCase()) {
    case 'z': case 'arrowup': return 'up';
    case 's': case 'arrowdown': return 'down';
    case 'q': case 'arrowleft': return 'left';
    case 'd': case 'arrowright': return 'right';
    default: return null;
  }
}

export class RTSCameraController {
  readonly camera: THREE.OrthographicCamera;
  private readonly focus = new THREE.Vector3(START_POSITIONS.player.x + 4, 0, START_POSITIONS.player.z - 4);
  private readonly pressed = new Set<string>();
  private zoom = 1;
  private readonly viewSize = 30;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 420);
    this.camera.position.copy(this.focus).add(CAMERA_OFFSET);
    this.camera.lookAt(this.focus);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.sync();
  }

  /** Current zoom factor; the shadow frustum widens with it as the view opens up. */
  get zoomLevel(): number { return this.zoom; }

  /** World-space point the camera is centred on; the sun and shadows follow it. */
  get focusPoint(): THREE.Vector3 { return this.focus; }

  update(delta: number): void {
    let dx = 0; let dz = 0;
    if (this.pressed.has('up')) dz -= 1;
    if (this.pressed.has('down')) dz += 1;
    if (this.pressed.has('left')) dx -= 1;
    if (this.pressed.has('right')) dx += 1;
    if (dx === 0 && dz === 0) return;
    const length = Math.hypot(dx, dz);
    const speed = 34 / this.zoom;
    this.focus.x += (dx / length) * speed * delta;
    this.focus.z += (dz / length) * speed * delta;
    this.clampFocus();
    this.sync();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    const direction = panDirectionForKey(event.key);
    if (direction) {
      this.pressed.add(direction);
      event.preventDefault();
    }
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const direction = panDirectionForKey(event.key);
    if (direction) this.pressed.delete(direction);
  };
  private readonly onBlur = (): void => { this.pressed.clear(); };
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.ctrlKey) {
      // macOS exposes trackpad pinch as a ctrl-modified wheel gesture.
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(-event.deltaY * 0.01), 0.28, 2.2);
      this.resize();
      return;
    }

    // Two-finger trackpad scrolling pans in screen space. The camera looks
    // diagonally across the XZ plane, so combine both world axes per gesture.
    const factor = 0.022 / this.zoom;
    this.focus.x += (event.deltaX - event.deltaY * 0.72) * factor;
    this.focus.z += (-event.deltaX - event.deltaY * 0.72) * factor;
    this.clampFocus();
    this.sync();
  };

  readonly resize = (): void => {
    const aspect = Math.max(0.25, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    const halfHeight = this.viewSize / (2 * this.zoom);
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  };

  private clampFocus(): void {
    this.focus.x = THREE.MathUtils.clamp(this.focus.x, MAP_BOUNDS.minX + 3, MAP_BOUNDS.maxX - 3);
    this.focus.z = THREE.MathUtils.clamp(this.focus.z, MAP_BOUNDS.minZ + 3, MAP_BOUNDS.maxZ - 3);
  }

  private sync(): void {
    this.camera.position.copy(this.focus).add(CAMERA_OFFSET);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
}
