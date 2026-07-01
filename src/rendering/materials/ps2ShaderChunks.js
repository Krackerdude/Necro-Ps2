/**
 * GLSL chunks for the PS2 rendering quirks, injected into three.js materials
 * by Ps2MaterialSystem via onBeforeCompile.
 *
 * Two effects, both toggleable at runtime through shared uniforms (no shader
 * recompile on toggle):
 *
 * 1. Vertex snapping ("jitter"): the PS2's GS rasterized to a coarse
 *    fixed-point grid, so vertices visibly pop as objects move. We snap NDC
 *    coordinates to a virtual grid derived from the internal resolution.
 *
 * 2. Affine texture mapping: the PS2 had no perspective-correct texturing.
 *    We multiply UVs by clip-space w in the vertex shader and divide by an
 *    interpolated w in the fragment shader, recreating the classic warp.
 */

export const PS2_UNIFORM_DECLS_VERTEX = /* glsl */ `
uniform float uPs2SnapEnabled;
uniform float uPs2AffineEnabled;
uniform vec2 uPs2Resolution;
#ifdef USE_MAP
varying float vPs2AffineW;
#endif
`;

export const PS2_UNIFORM_DECLS_FRAGMENT = /* glsl */ `
uniform float uPs2AffineEnabled;
#ifdef USE_MAP
varying float vPs2AffineW;
#endif
`;

/** Appended immediately after `#include <project_vertex>`. */
export const PS2_PROJECT_VERTEX_SUFFIX = /* glsl */ `
#ifdef USE_MAP
vPs2AffineW = 1.0;
if (uPs2AffineEnabled > 0.5 && gl_Position.w > 0.0) {
  vPs2AffineW = gl_Position.w;
  vMapUv *= gl_Position.w;
}
#endif
if (uPs2SnapEnabled > 0.5 && gl_Position.w > 0.0) {
  vec2 grid = uPs2Resolution * 0.5;
  vec3 ndc = gl_Position.xyz / gl_Position.w;
  ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
  gl_Position.xyz = ndc * gl_Position.w;
}
`;

/** Replaces `#include <map_fragment>` to sample with the affine-warped UV. */
export const PS2_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
vec2 ps2Uv = vMapUv / vPs2AffineW;
vec4 sampledDiffuseColor = texture2D( map, ps2Uv );
diffuseColor *= sampledDiffuseColor;
#endif
`;
