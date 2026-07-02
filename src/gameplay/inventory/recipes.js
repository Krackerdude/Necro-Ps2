/**
 * Combination recipes — the herb-mixing grammar.
 *
 * Unordered pairs; combining consumes one of each ingredient and yields the
 * result. Adding a recipe = adding an entry; the satchel's combine mode and
 * flavor toasts come along for free.
 */
export const RECIPES = [
  {
    pair: ['graveMoss', 'linenStrips'],
    result: 'mossPoultice',
    flavor: 'You bind the moss in linen. A field dressing, the old way.',
  },
  {
    pair: ['mossPoultice', 'graveTonic'],
    result: 'blessedSalve',
    flavor: 'The tonic soaks into the poultice and begins, faintly, to hum.',
  },
];

/** Find the recipe for two item ids in either order (or null). */
export function findRecipe(a, b) {
  return (
    RECIPES.find(
      (r) => (r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a)
    ) ?? null
  );
}

/** Does ANY recipe involve this item? (drives the Combine button) */
export function isCombinable(id) {
  return RECIPES.some((r) => r.pair.includes(id));
}
