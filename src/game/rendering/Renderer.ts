import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * WebGL renderer plus the post-processing chain that gives the colony its rendered look: a tight
 * bloom makes every emissive light strip glow, and ground-truth ambient occlusion can tuck
 * structures into the ground.
 *
 * Bloom is on by default because the art direction depends on it. AO is opt-in via `?ao=on`: it
 * costs a full depth-normal pass over everything the camera can see, which the isometric framing
 * made far too expensive. `?post=off` disables the chain entirely.
 */
/** How much frame the machine can afford. Stepped automatically from the measured frame rate. */
export type RenderQuality = 'high' | 'medium' | 'low';

/** Frame rate below which the frame is too expensive for this machine, and above which it is not. */
export const QUALITY_FLOOR_FPS = 45;
export const QUALITY_CEILING_FPS = 58;
/** Seconds of sustained trouble before stepping down, and of sustained comfort before stepping up. */
export const QUALITY_DOWN_SECONDS = 3;
export const QUALITY_UP_SECONDS = 25;

/**
 * The next quality tier, or null to stay put.
 *
 * Asymmetric on purpose: three seconds of poor frames is enough to act on, while going back up
 * wants twenty-five seconds of comfortable headroom. A symmetric rule oscillates -- the step up
 * restores exactly the load that caused the step down -- and a flickering resolution is worse to
 * look at than a permanently lower one.
 */
/** Device-pixel-ratio ceiling per tier: the largest multiplier on what a frame costs. */
function pixelCeiling(quality: RenderQuality): number {
  return quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
}

export function nextQuality(current: RenderQuality, slowSeconds: number, fastSeconds: number): RenderQuality | null {
  if (slowSeconds > QUALITY_DOWN_SECONDS && current !== 'low') return current === 'high' ? 'medium' : 'low';
  if (fastSeconds > QUALITY_UP_SECONDS && current !== 'high') return current === 'low' ? 'medium' : 'high';
  return null;
}

export class Renderer {
  readonly instance: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private readonly postEnabled: boolean;
  private readonly aoEnabled: boolean;
  private quality: RenderQuality = 'high';
  private readonly pinnedQuality: RenderQuality | null = null;

  /** The current quality tier, for the diagnostics overlay. */
  get qualityLevel(): RenderQuality { return this.quality; }

  /**
   * Scales what the frame costs to the machine drawing it.
   *
   * A 300x224 battlefield on a Retina panel asks for eight megapixels a frame, and every one of
   * them goes through a bloom pass; the same scene at 1x is a quarter of the work for a picture
   * most players would not pick out of a line-up. Resolution goes first because it is the largest
   * multiplier and the least visible loss, bloom second, and shadow resolution last.
   */
  setQuality(quality: RenderQuality): boolean {
    if (this.pinnedQuality !== null && quality !== this.pinnedQuality) return false;
    if (quality === this.quality) return false;
    this.quality = quality;
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, pixelCeiling(quality)));
    if (this.bloom) this.bloom.enabled = quality !== 'low';
    this.resize();
    return true;
  }

  constructor(readonly container: HTMLElement) {
    this.instance = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    // Lifted so the armour plates sit near white without the emissive strips clipping.
    this.instance.toneMappingExposure = 1.12;
    this.instance.domElement.className = 'game-canvas';
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    this.postEnabled = params.get('post') !== 'off';
    // Opt-in. GTAO renders a full depth-normal pass of the scene, and the isometric camera
    // sees several times more of the world than the old steep one did: it measured 57 FPS
    // without and 33 with, for an occlusion tuck most players will never notice.
    this.aoEnabled = params.get('ao') === 'on';
    // `?quality=low` pins the tier instead of letting the frame rate choose it, which is how a
    // machine-specific report gets reproduced on a machine that never drops a frame.
    const pinned = params.get('quality');
    this.pinnedQuality = pinned === 'low' || pinned === 'medium' || pinned === 'high' ? pinned : null;
    if (this.pinnedQuality) {
      this.quality = this.pinnedQuality;
      this.instance.setPixelRatio(Math.min(window.devicePixelRatio, pixelCeiling(this.quality)));
    }
    container.append(this.instance.domElement);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Pixels the GPU actually fills each frame: CSS size times device pixel ratio, squared up. */
  get drawingBufferPixels(): number {
    const size = this.instance.getDrawingBufferSize(new THREE.Vector2());
    return Math.round(size.x * size.y);
  }

  resize = (): void => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.instance.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloom?.setSize(width, height);
  };

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.postEnabled) { this.instance.render(scene, camera); return; }
    if (!this.composer) this.buildComposer(scene, camera);
    this.composer!.render();
  }

  private buildComposer(scene: THREE.Scene, camera: THREE.Camera): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const composer = new EffectComposer(this.instance);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, width, height);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1, thickness: 1, scale: 1.3, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.blendIntensity = 0.9;
    if (this.aoEnabled) composer.addPass(gtao);
    // Strength and threshold tuned so only the emissive strips bloom: the reference glows at
    // the seams, it does not wash the whole frame.
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.18, 0.35, 1.15);
    bloom.enabled = this.quality !== 'low';
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.gtao = gtao;
    this.bloom = bloom;
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.gtao?.dispose();
    this.bloom?.dispose();
    this.composer?.dispose();
    this.instance.dispose();
    this.instance.domElement.remove();
  }
}
