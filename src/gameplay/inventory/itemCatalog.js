/**
 * Item catalog — every item that can exist, as data.
 *
 * Kinds:
 *   'weapon'     — equippable; stats drive combat/WeaponSystem.
 *   'ammo'       — stackable; consumed by the weapon whose `usesAmmo` matches.
 *   'consumable' — usable from the inventory screen; `use(ctx)` returns true
 *                  if the item was consumed. ctx: { stats, events }.
 *   'key'        — quest items; consumed implicitly by interactables that
 *                  check `inventory.has(id)`.
 *
 * Adding an item = adding an entry. The inventory UI, HUD readout, pickups,
 * and save system all consume this table. Never hardcode item behavior
 * elsewhere.
 *
 * `glyph` is the 1–2 character mark shown on the inventory tile until real
 * item art exists (the tile renderer is the seam for icons later).
 */
export const ITEMS = Object.freeze({
  rustMachete: {
    kind: 'weapon',
    name: 'Rust-Eaten Machete',
    glyph: '⌐',
    description:
      'A grounds-keeping blade gone orange with rot. Short reach, but it never runs dry.',
    weapon: { type: 'melee', damage: 22, range: 1.5, arcDeg: 75, swingTime: 0.45 },
  },

  boneRevolver: {
    kind: 'weapon',
    name: 'Ossuary Revolver',
    glyph: '⌖',
    description:
      'A service revolver interred with its owner. Six chambers; the cylinder is carved with teeth.',
    weapon: { type: 'ranged', damage: 38, range: 15, usesAmmo: 'boneShells', fireTime: 0.6 },
  },

  proofingPistol: {
    kind: 'weapon',
    name: 'Proofing Piece',
    glyph: '⌐⌖',
    description:
      'A scrivener’s single-shot pistol, used to test-fire tallow rounds before binding them into ledgers of account. Kicks like an apology; better than nothing by exactly one shot at a time.',
    weapon: { type: 'ranged', damage: 22, range: 11, usesAmmo: 'boneShells', fireTime: 1.05 },
  },

  boneShells: {
    kind: 'ammo',
    name: 'Tallow Rounds',
    glyph: '::',
    stack: 30,
    description: 'Hand-cast rounds sealed in grave tallow. They fire, mostly.',
  },

  graveTonic: {
    kind: 'consumable',
    name: 'Grave Tonic',
    glyph: '♥',
    stack: 3,
    description: 'A sacramental bottle, contents still moving. Restores most wounds.',
    use: ({ stats, events }) => {
      if (stats.health >= stats.maxHealth) return false;
      stats.heal(60);
      events.emit('audio/sfx', { id: 'heal' });
      events.emit('ui/toast', { text: 'The tonic tastes of copper and church air.' });
      return true;
    },
  },

  mossPoultice: {
    kind: 'consumable',
    name: 'Moss Poultice',
    glyph: '✚',
    stack: 5,
    description: 'Grave moss packed in linen. Stings like guilt, closes like a promise.',
    use: ({ stats, events }) => {
      if (stats.health >= stats.maxHealth) return false;
      stats.heal(25);
      events.emit('audio/sfx', { id: 'heal' });
      return true;
    },
  },

  graveMoss: {
    kind: 'consumable',
    name: 'Grave Moss',
    glyph: '❦',
    stack: 5,
    description:
      'Pale moss that only grows where something is buried badly. Bitter, raw — better bound in linen.',
    use: ({ stats, events }) => {
      if (stats.health >= stats.maxHealth) return false;
      stats.heal(10); // raw moss barely helps; combine it
      events.emit('audio/sfx', { id: 'heal' });
      return true;
    },
  },

  linenStrips: {
    kind: 'consumable',
    name: 'Linen Strips',
    glyph: '≋',
    stack: 5,
    description: 'Altar linen torn into bandage widths. Someone else had the same idea once.',
    use: () => false, // no use alone — combine with moss
  },

  blessedSalve: {
    kind: 'consumable',
    name: 'Blessed Salve',
    glyph: '✠',
    stack: 2,
    description:
      'Tonic worked into a poultice until it hums. Closes anything that still counts as a wound.',
    use: ({ stats, events }) => {
      if (stats.health >= stats.maxHealth) return false;
      stats.heal(100);
      events.emit('audio/sfx', { id: 'heal' });
      events.emit('ui/toast', { text: 'The salve hums against the skin. Whole again.' });
      return true;
    },
  },

  freshBread: {
    kind: 'consumable',
    name: 'Fresh Bread',
    glyph: '◗',
    stack: 3,
    description:
      'Still warm from Rosa’s oven. The crust cracks like something glad to be opened.',
    use: ({ stats, events }) => {
      if (stats.health >= stats.maxHealth) return false;
      stats.heal(30);
      events.emit('audio/sfx', { id: 'heal' });
      events.emit('ui/toast', { text: 'It tastes like the town wants you to stay.' });
      return true;
    },
  },

  mikesPhotograph: {
    kind: 'key',
    name: 'Mike’s Photograph',
    glyph: '▣',
    description:
      'Mike, squinting into some other summer, one arm around a stranger’s dog. ' +
      'The only recent picture of him you own. You’ve shown it to enough people ' +
      'that the corners have gone soft.',
  },

  stoneOfTheHour: {
    kind: 'key',
    name: 'Stone of the Hour',
    glyph: '♠',
    description:
      'Heavy as a held breath. Faint tolling from inside it, on no schedule you can trust.',
    spentWhen: (story) => Boolean(story.get('cageOpened')),
    discardFlavor: 'The Stone of the Hour stays with the cage. Its watch is over.',
  },

  stoneOfTheWord: {
    kind: 'key',
    name: 'Stone of the Word',
    glyph: '♦',
    description:
      'Covered in script too small to read. It rearranges when you are not looking, and sometimes when you are.',
    spentWhen: (story) => Boolean(story.get('cageOpened')),
    discardFlavor: 'The Stone of the Word stays with the cage. It has said its piece.',
  },

  stoneOfTheGround: {
    kind: 'key',
    name: 'Stone of the Ground',
    glyph: '♣',
    description:
      'Warm, damp, and very slightly breathing. You carry it the way you would carry an apology.',
    spentWhen: (story) => Boolean(story.get('cageOpened')),
    discardFlavor: 'The Stone of the Ground stays with the cage. The ground accepts.',
  },

  silkBookmark: {
    kind: 'key',
    name: 'Silk Bookmark',
    glyph: '~',
    stack: 9,
    description:
      'A ribbon of red silk, warm as a pulse. Moth calls them her sisters. There are nine, she says. There were ten, she doesn’t say.',
    spentWhen: (story) => Boolean(story.get('mothQuestDone')),
    discardFlavor: 'The bookmarks are with Moth now. All her sisters, home.',
  },

  spadeKey: {
    kind: 'key',
    name: 'Spade Key',
    glyph: '♤',
    description: 'Black iron, bow shaped like a grave-spade. It opens every door that digs.',
  },

  diamondKey: {
    kind: 'key',
    name: 'Diamond Key',
    glyph: '♢',
    description: 'Cold glass over colder iron. It opens every door that reads.',
  },

  cloverKey: {
    kind: 'key',
    name: 'Clover Key',
    glyph: '♧',
    description: 'Green bronze, three-lobed bow. It opens every door that grows.',
  },

  wardensDraught: {
    kind: 'consumable',
    name: 'Warden’s Draught',
    glyph: '♥',
    stack: 3,
    description:
      'A sealed vial from the warden’s own stores. Whatever it costs, it is paid by someone else.',
    use: ({ stats, events }) => {
      stats.increaseMaxHealth(25);
      events.emit('audio/sfx', { id: 'saveChime' });
      events.emit('ui/toast', { text: 'Your blood learns a new depth. MAX CONDITION UP.' });
      return true;
    },
  },

  blackIronKey: {
    kind: 'key',
    name: 'Black Iron Key',
    glyph: '†',
    description: 'Colder than the room. The wards on the bow face inward.',
    // Spent keys leave on their own — no dead weight in the satchel.
    spentWhen: (story) => Boolean(story.get('cryptDoorOpen')),
    discardFlavor: 'The black key crumbles to cold ash. Its work is done.',
  },

  verdigrisKey: {
    kind: 'key',
    name: 'Verdigris Key',
    glyph: '‡',
    description: 'Bronze gone green in the flooded garth. It smells of pond water and myrrh.',
    spentWhen: (story) => Boolean(story.get('cloisterGateOpen')),
    discardFlavor: 'The verdigris key comes apart in green flakes on your palm.',
  },

  hollowIcon: {
    kind: 'key',
    name: 'The Hollow Icon',
    glyph: '◊',
    description:
      'The metal squirms faintly, like a held bird. The ground below is quieter while you carry it.',
  },
});

export function getItem(id) {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item '${id}'`);
  return def;
}
