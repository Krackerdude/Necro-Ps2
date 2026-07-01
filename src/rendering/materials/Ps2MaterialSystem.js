import {
  PS2_UNIFORM_DECLS_VERTEX,
  PS2_UNIFORM_DECLS_FRAGMENT,
  PS2_PROJECT_VERTEX_SUFFIX,
  PS2_MAP_FRAGMENT,
} from './ps2ShaderChunks.js';

/**
 * Ps2MaterialSystem — patches standard three.js materials with the PS2
 * vertex-snapping and affine-texture shader quirks.
 *
 * All patched materials share the SAME uniform objects, so flipping a
 * settings toggle updates every material instantly with zero recompiles.
 *
 * Usage (typically via world/geometry factories):
 *   const mat = renderService.ps2Materials.patch(new MeshStandardMaterial(...));
 *
 * Materials stay fully PBR (MeshStandardMaterial) — the PS2 look is a
 * projection/texturing quirk layered on top, not a lighting downgrade.
 */
export class Ps2MaterialSystem {
  #uniforms = {
    uPs2SnapEnabled: { value: 1 },
    uPs2AffineEnabled: { value: 1 },
    uPs2Resolution: { value: { x: 640, y: 448 } },
  };

  constructor(events, settings) {
    this.#syncFromSettings(settings);
    events.on('settings/changed', ({ path }) => {
      if (path.startsWith('graphics.ps2')) this.#syncFromSettings(settings);
    });
  }

  /**
   * @template {import('three').Material} M
   * @param {M} material
   * @returns {M} the same material, patched
   */
  patch(material) {
    const uniforms = this.#uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${PS2_UNIFORM_DECLS_VERTEX}`)
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>\n${PS2_PROJECT_VERTEX_SUFFIX}`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PS2_UNIFORM_DECLS_FRAGMENT}`)
        .replace('#include <map_fragment>', PS2_MAP_FRAGMENT);
    };
    // Distinguish patched shaders in three's program cache.
    material.customProgramCacheKey = () => 'ps2';
    return material;
  }

  setResolution(width, height) {
    this.#uniforms.uPs2Resolution.value.x = width;
    this.#uniforms.uPs2Resolution.value.y = height;
  }

  #syncFromSettings(settings) {
    this.#uniforms.uPs2SnapEnabled.value = settings.get('graphics.ps2Jitter') ? 1 : 0;
    this.#uniforms.uPs2AffineEnabled.value = settings.get('graphics.ps2AffineTextures') ? 1 : 0;
  }
}
