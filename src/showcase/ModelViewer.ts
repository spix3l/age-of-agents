import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ResourceCache } from '../game/rendering/models/palette';
import type { ModelEntry } from './registry';

export interface ViewerOptions {
  /** Camera orbit in degrees; the defaults sit near the sheet's own three-quarter view. */
  readonly azimuth: number;
  readonly elevation: number;
  /** Multiplier on the auto-framed distance, so 1 always fits the model whatever its size. */
  readonly zoom: number;
  readonly spin: boolean;
  readonly grid: boolean;
  readonly background: string;
  /**
   * Strip every material down to one neutral matte. The blockout gate scores shape against the
   * reference and refuses a render whose colour could be doing the work, so the lab has to be
   * able to produce that render itself rather than the reviewer eyeballing "ignore the paint".
   */
  readonly stripMaps: boolean;
  /** Orthographic capture: matches the flat sheet-cell references the review gates compare. */
  readonly ortho: boolean;
}

export const DEFAULT_OPTIONS: ViewerOptions = {
  azimuth: 215,
  elevation: 28,
  zoom: 1,
  spin: false,
  grid: true,
  background: '#0b1418',
  stripMaps: false,
  ortho: false,
};

const RAD = Math.PI / 180;

/**
 * One model, alone, on a turntable. Deliberately independent of the game's Renderer: the lab has
 * to be able to show a model that the game does not render yet, and the img2threejs review loop
 * screenshots this route, so its camera has to be reproducible from the URL alone.
 */
export class ModelViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  // Near plane stays small; the ortho path places the camera far out (distance*4) so geometry
  // never clips even at elevation 0 through the model's mid-height.
  private readonly orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 400);
  private readonly root = new THREE.Group();
  private readonly cache = new ResourceCache();
  private readonly grid: THREE.GridHelper;
  private readonly strippedMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c0c6,
    roughness: 0.75,
    metalness: 0.0,
  });
  private readonly ground: THREE.Mesh;
  private options: ViewerOptions = DEFAULT_OPTIONS;
  private frameDistance = 6;
  private target = new THREE.Vector3();
  private spinAngle = 0;
  private readonly environment: THREE.Texture;
  private disposed = false;
  private last = performance.now();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      // Needed for `background: 'none'`, which the review gates rely on: their segmenter reads
      // alpha, and against an opaque backdrop it takes the whole frame as foreground and reports
      // every azimuth unsegmented.
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Metals are black without something to reflect. The battlefield gets that from its sky; the
    // lab generates a neutral room probe, which keeps a reconstructed model's measured metalness
    // readable instead of forcing the value down to fake a lit look.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;
    // The probe is there to give metals something to reflect, not to light the model -- the
    // three-light rig below does that, and it is the battlefield's rig, so the lab and a match
    // agree. At 0.4 dark reconstructed steel still washed to mid grey (measured live: only 0.12
    // with per-material envMapIntensity ~0.25 holds the near-black reference value), so it runs
    // at 0.15 and each generated spec carries its own per-material envMapIntensity instead.
    this.scene.environmentIntensity = 0.15;

    // The same three-light rig the battlefield uses, so a model reads here as it will in a match.
    this.scene.add(new THREE.HemisphereLight(0xa9cde3, 0x33452e, 1.0));
    this.scene.add(new THREE.AmbientLight(0xbfd6e6, 0.3));
    const sun = new THREE.DirectionalLight(0xffe9cc, 2.1);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      sun.shadow.camera[side] = side === 'left' || side === 'bottom' ? -10 : 10;
    }
    this.scene.add(sun, sun.target);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    this.ground.receiveShadow = true;
    this.grid = new THREE.GridHelper(1, 10, 0x2c5a68, 0x1b3038);
    this.scene.add(this.root, this.ground, this.grid);
    // Review gates capture with `bg=none` (transparent) and segment the subject by alpha. The
    // ShadowMaterial ground's faint cast-shadow veil (alpha ~0.35 over soft edges) then reaches
    // the frame bottom and the segmenter counts it as part of the subject, wrecking silhouette
    // IoU/aspect measurements. References are sheet cells with no ground, so on transparent
    // captures the ground goes away with the backdrop.
    this.ground.visible = this.options.background !== 'none';

    this.animate();
  }

  setOptions(options: ViewerOptions): void {
    this.options = options;
    this.scene.background = options.background === 'none'
      ? null
      : new THREE.Color(options.background);
    this.renderer.setClearAlpha(options.background === 'none' ? 0 : 1);
    this.grid.visible = options.grid;
    this.ground.visible = options.background !== 'none';
    if (!options.spin) this.spinAngle = 0;
  }

  private frameRadius = 3;

  /** Swaps in a new model and reframes the camera around its bounds. */
  show(entry: ModelEntry): void {
    this.root.clear();
    this.spinAngle = 0;
    if (!entry.build) {
      this.frameDistance = 6;
      this.target.set(0, 0.5, 0);
      this.resizeHelpers(2);
      return;
    }
    const model = entry.build(this.cache);
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if (this.options.stripMaps) mesh.material = this.strippedMaterial;
    });
    this.root.add(model);    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.5);
    this.frameRadius = radius;
    const orthoAspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1);

    box.getCenter(this.target);
    // Ground the model on the grid rather than on whatever origin the factory chose.
    this.root.position.y = -box.min.y;
    this.target.y += -box.min.y;
    this.frameDistance = radius / Math.sin((this.camera.fov * RAD) / 2) * 1.15;
    // Orthographic framing: fit the model's projected size directly, with the same 1.15 margin
    // as the perspective path so zoom=1 keeps the usual auto-frame.
    const halfSpan = radius * 1.15;
    this.orthoCamera.left = -halfSpan * orthoAspect;
    this.orthoCamera.right = halfSpan * orthoAspect;
    this.orthoCamera.top = halfSpan;
    this.orthoCamera.bottom = -halfSpan;
    this.orthoCamera.updateProjectionMatrix();
    this.resizeHelpers(Math.max(size.x, size.z) * 1.8);
  }

  private resizeHelpers(span: number): void {
    this.ground.scale.setScalar(span);
    this.grid.scale.setScalar(span);
  }

  /** A PNG data URL of the current frame — how the review loop captures evidence. */
  snapshot(): string {
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose(): void {
    this.disposed = true;
    this.environment.dispose();
    this.strippedMaterial.dispose();
    this.cache.dispose();
    this.renderer.dispose();
  }

  private animate = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (this.options.spin) this.spinAngle = (this.spinAngle + dt * 24) % 360;
    this.render();
  };

  private render(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    if (this.canvas.width !== clientWidth || this.canvas.height !== clientHeight) {
      this.renderer.setSize(clientWidth, clientHeight, false);
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
    }
    const azimuth = (this.options.azimuth + this.spinAngle) * RAD;
    const elevation = THREE.MathUtils.clamp(this.options.elevation, -89, 89) * RAD;
    if (this.options.ortho) {
      // Same orbit as the perspective path; zoom scales the ortho frustum instead of distance.
      // `frameRadius` is cached at show() time because render() runs every frame. Note
      // OrthographicCamera has no `aspect` of its own — use the canvas's.
      const aspect = clientWidth / Math.max(clientHeight, 1);
      const halfSpan = (this.frameRadius * 1.15) / Math.max(this.options.zoom, 0.05);
      const cam = this.orthoCamera;
      if (cam.top !== halfSpan || cam.right !== halfSpan * aspect) {
        cam.left = -halfSpan * aspect;
        cam.right = halfSpan * aspect;
        cam.top = halfSpan;
        cam.bottom = -halfSpan;
        cam.updateProjectionMatrix();
      }
      const distance = this.frameDistance * 4;
      cam.position.set(
        this.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
        this.target.y + distance * Math.sin(elevation),
        this.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
      );
      cam.lookAt(this.target);
      this.renderer.render(this.scene, cam);
      return;
    }
    const distance = this.frameDistance / Math.max(this.options.zoom, 0.05);
    this.camera.position.set(
      this.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      this.target.y + distance * Math.sin(elevation),
      this.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
