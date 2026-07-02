import { CHAPEL_OF_THE_HOLLOW } from './chapelOfTheHollow.js';
import { SUNKEN_CLOISTER } from './sunkenCloister.js';
import { OSSUARY_OF_THE_HOLLOW } from './ossuaryOfTheHollow.js';
import { MENU_VISTA } from './menuVista.js';
import { GRAVEN_TOWN } from './gravenTown.js';

/**
 * Level registry — id -> definition.
 *
 * Definitions are statically imported for now (two levels). When the level
 * count grows, swap the values for dynamic `() => import(...)` loaders and
 * make WorldService.loadLevel async — callers already treat load as a
 * transition point, so nothing else changes.
 */
const LEVELS = Object.freeze({
  [CHAPEL_OF_THE_HOLLOW.id]: CHAPEL_OF_THE_HOLLOW,
  [SUNKEN_CLOISTER.id]: SUNKEN_CLOISTER,
  [OSSUARY_OF_THE_HOLLOW.id]: OSSUARY_OF_THE_HOLLOW,
  [MENU_VISTA.id]: MENU_VISTA,
  [GRAVEN_TOWN.id]: GRAVEN_TOWN,
});

export function getLevel(id) {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level '${id}'. Known: ${Object.keys(LEVELS).join(', ')}`);
  return level;
}

/** The level a fresh "New Game" starts in. */
export const STARTING_LEVEL_ID = CHAPEL_OF_THE_HOLLOW.id;
