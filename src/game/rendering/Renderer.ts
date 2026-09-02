import * as THREE from 'three';

export class Renderer {
  readonly instance: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;

  constructor(readonly container: HTMLElement) {
    this.instance = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.15;
    this.instance.domElement.className = 'game-canvas';
    container.append(this.instance.domElement);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
  }

  resize = (): void => {
    this.instance.setSize(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight), false);
  };

  render(scene: THREE.Scene, camera: THREE.Camera): void { this.instance.render(scene, camera); }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.instance.dispose();
    this.instance.domElement.remove();
  }
}
