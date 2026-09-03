import * as THREE from 'three';
import { MAP_BOUNDS, START_POSITIONS } from '../world/map';

/**
 * A perspective camera that looks straight down the map's depth axis from a raised, tilted
 * position. Buildings sit square to the screen and the ground recedes toward a real horizon,
 * which is what gives a low-poly world its diorama feel. Zoom moves the camera along its
 * viewing ray rather than changing the projection.
 */
const PITCH = THREE.MathUtils.degToRad(60);
const FIELD_OF_VIEW = 34;
const DEFAULT_DISTANCE = 72;
const MIN_DISTANCE = 26;
const MAX_DISTANCE = 170;

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
  readonly camera: THREE.PerspectiveCamera;
  private readonly focus = new THREE.Vector3(START_POSITIONS.player.x + 6, 0, START_POSITIONS.player.z - 6);
  private readonly pressed = new Set<string>();
  private distance = DEFAULT_DISTANCE;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 16 / 9, 1, 700);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.sync();
  }

  /** Relative magnification: 1 at the default distance, above 1 when closer. */
  get zoomLevel(): number { return DEFAULT_DISTANCE / this.distance; }

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
    const speed = 36 / this.zoomLevel;
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
      this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(event.deltaY * 0.01), MIN_DISTANCE, MAX_DISTANCE);
      this.sync();
      return;
    }

    // Two-finger trackpad scrolling pans in screen space. The camera looks straight down
    // the depth axis, so screen X is world X and screen Y is world Z.
    const factor = 0.024 / this.zoomLevel;
    this.focus.x += event.deltaX * factor;
    this.focus.z += event.deltaY * factor;
    this.clampFocus();
    this.sync();
  };

  readonly resize = (): void => {
    this.camera.aspect = Math.max(0.25, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.camera.updateProjectionMatrix();
  };

  private clampFocus(): void {
    this.focus.x = THREE.MathUtils.clamp(this.focus.x, MAP_BOUNDS.minX + 3, MAP_BOUNDS.maxX - 3);
    this.focus.z = THREE.MathUtils.clamp(this.focus.z, MAP_BOUNDS.minZ + 3, MAP_BOUNDS.maxZ - 3);
  }

  private sync(): void {
    this.camera.position.set(
      this.focus.x,
      this.focus.y + Math.sin(PITCH) * this.distance,
      this.focus.z + Math.cos(PITCH) * this.distance,
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
}
