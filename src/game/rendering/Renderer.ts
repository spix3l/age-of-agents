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
export class Renderer {
  readonly instance: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private readonly postEnabled: boolean;
  private readonly aoEnabled: boolean;

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
    container.append(this.instance.domElement);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
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
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.5, 0.95);
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
