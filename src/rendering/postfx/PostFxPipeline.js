import { EffectComposer, EffectPass, NormalPass, RenderPass } from 'postprocessing';
import { EFFECT_REGISTRY, GROUP_ORDER } from './effectRegistry.js';

/**
 * PostFxPipeline — builds and owns the postprocessing EffectComposer.
 *
 * The pipeline is declarative: it reads EFFECT_REGISTRY, keeps only effects
 * whose settings toggle is on, groups them into passes, and renders. When a
 * toggle / scene / camera / resolution changes, the whole pass chain is
 * rebuilt. Rebuilds are rare (user flips an option, level transition), so
 * clarity beats micro-optimizing pass reuse here.
 */
export class PostFxPipeline {
  #composer;
  #settings;
  #renderService;
  #activeEffects = [];
  #normalPass = null;

  constructor(events, settings, renderService) {
    this.#settings = settings;
    this.#renderService = renderService;
    this.#composer = new EffectComposer(renderService.renderer);

    events.on('render/scene-changed', () => this.rebuild());
    events.on('render/camera-changed', () => this.rebuild());
    events.on('render/resolution-changed', ({ width, height }) => {
      this.#composer.setSize(width, height);
      this.rebuild();
    });
    events.on('settings/changed', ({ path }) => {
      if (path.startsWith('graphics.effects') || path === 'graphics.colorGradingLut') {
        this.rebuild();
      }
    });

    const { width, height } = renderService.getInternalSize();
    this.#composer.setSize(width, height);
  }

  render(dt) {
    const { scene, camera } = this.#renderService;
    if (!scene || !camera) return;
    this.#composer.render(dt);
  }

  rebuild() {
    const { scene, camera } = this.#renderService;
    this.#teardownPasses();
    if (!scene || !camera) return;

    this.#composer.addPass(new RenderPass(scene, camera));

    const enabled = EFFECT_REGISTRY.filter(
      (entry) => this.#settings.get(`graphics.effects.${entry.id}`) === true
    );

    if (enabled.some((e) => e.needsNormals)) {
      this.#normalPass = new NormalPass(scene, camera);
      this.#composer.addPass(this.#normalPass);
    }

    const ctx = {
      scene,
      camera,
      settings: this.#settings,
      normalTexture: this.#normalPass?.texture ?? null,
    };

    for (const group of GROUP_ORDER) {
      const effects = enabled
        .filter((entry) => entry.group === group)
        .map((entry) => entry.build(ctx));
      if (effects.length === 0) continue;
      this.#activeEffects.push(...effects);
      this.#composer.addPass(new EffectPass(camera, ...effects));
    }
  }

  #teardownPasses() {
    this.#composer.removeAllPasses();
    for (const effect of this.#activeEffects) effect.dispose?.();
    this.#activeEffects = [];
    this.#normalPass = null;
  }

  dispose() {
    this.#teardownPasses();
    this.#composer.dispose();
  }
}
