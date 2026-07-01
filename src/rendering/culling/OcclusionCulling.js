/**
 * Occlusion culling — NOT IMPLEMENTED YET (intentionally).
 *
 * Frustum culling is already active engine-wide (three.js default,
 * `object.frustumCulled`). Fixed-camera rooms give us a cheaper and better
 * lever first: room-based visibility sets (each CameraZone lists the room
 * groups visible from that shot; everything else gets `visible = false`).
 *
 * TODO(occlusion): implement in this order when a measurable need appears:
 *   1. Per-CameraZone visibility sets (data-driven, zero runtime cost).
 *      Hook point: 'camera/zone-changed' event + LevelRuntime room groups.
 *   2. WebGL2 occlusion queries (GL_ANY_SAMPLES_PASSED) for dynamic objects,
 *      one-frame-latency accept.
 *
 * This file exists so the intended design lives next to the culling domain
 * instead of in someone's head. Do not add fake "always visible" logic here.
 */
export const OCCLUSION_CULLING_IMPLEMENTED = false;
