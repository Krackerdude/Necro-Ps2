import { Engine } from './core/Engine.js';

/**
 * Entry point. Everything interesting happens in core/Engine.js (composition
 * root) and core/states/ (application flow).
 */
const viewport = document.getElementById('viewport');
const uiRoot = document.getElementById('ui-root');

const engine = new Engine(viewport, uiRoot);
engine.start();

// Handy while developing; not part of any system's API.
if (import.meta.env.DEV) {
  window.__necro = engine;
}
