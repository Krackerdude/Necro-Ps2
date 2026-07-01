import * as THREE from 'three';
import { Ps2MaterialSystem } from './materials/Ps2MaterialSystem.js';

/**
 * RenderService — owns the WebGLRenderer, the canvas, and internal resolution.
 *
 * The PS2 look starts here: we render to a small internal buffer
 * (display.resolution × aspect, × display.resolutionScale) and let CSS
 * stretch the canvas to the window with nearest-neighbour sampling.
 *
 * This service does NOT decide what to render. The active scene/camera are
 * assigned by states (via setScene/setCamera), and the actual per-frame draw
 * is delegated to the PostFxPipeline, which calls back into `renderer`.
 */
export class RenderService {
  /** @type {THREE.WebGLRenderer} */
  renderer;
  /** @type {THREE.Scene | null} */
  scene = null;
  /** @type {THREE.PerspectiveCamera | null} */
  camera = null;
  /** @type {Ps2MaterialSystem} */
  ps2Materials;

  #events;
  #settings;
  #container;

  constructor(events, settings, container) {
    this.#events = events;
    this.#settings = settings;
    this.#container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // PS2s didn't have MSAA and neither do we.
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';

    this.ps2Materials = new Ps2MaterialSystem(events, settings);

    this.#applyShadowSettings();
    this.#applyResolution();

    window.addEventListener('resize', () => this.#applyResolution());
    events.on('settings/changed', ({ path }) => {
      if (path.startsWith('display')) this.#applyResolution();
      if (path.startsWith('graphics.shadow')) this.#applyShadowSettings();
    });
  }

  setScene(scene) {
    this.scene = scene;
    this.#events.emit('render/scene-changed', { scene });
  }

  setCamera(camera) {
    this.camera = camera;
    this.#applyCameraAspect();
    this.#events.emit('render/camera-changed', { camera });
  }

  /** Internal render size in physical pixels. */
  getInternalSize() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const scale = this.#settings.get('display.resolutionScale') ?? 1;
    const height = Math.round((this.#settings.get('display.resolution') ?? 448) * scale);
    const width = Math.round(height * aspect);
    return { width: Math.max(160, width), height: Math.max(120, height) };
  }

  #applyResolution() {
    const { width, height } = this.getInternalSize();
    // `false` = don't touch canvas CSS size; base.css stretches it fullscreen.
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.imageRendering = this.#settings.get('display.pixelated')
      ? 'pixelated'
      : 'auto';
    this.ps2Materials.setResolution(width, height);
    this.#applyCameraAspect();
    this.#events.emit('render/resolution-changed', { width, height });
  }

  #applyCameraAspect() {
    if (!this.camera) return;
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
  }

  #applyShadowSettings() {
    const enabled = this.#settings.get('graphics.shadows');
    this.renderer.shadowMap.enabled = enabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // hard-ish, era-correct
    this.#events.emit('render/shadows-changed', { enabled });
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
