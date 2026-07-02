/**
 * Documents — every readable text in the game, indexed.
 *
 * Reading one sets `doc:<id>` in the story (rides in saves), which makes it
 * re-readable from the satchel's DOCUMENTS shelf. Levels call readDocument()
 * from their interactables; the satchel re-opens them via the same event.
 *
 * The writing is the cheapest, strongest horror asset this project has —
 * add documents generously, one dread implication at a time.
 */
export const DOCUMENTS = {
  wardenNote: {
    title: 'THE WARDEN’S NOTE',
    body:
      'The congregation would not stop singing, so I nailed the doors.\n\n' +
      'I keep the black key upon the altar, where He can watch it.\n\n' +
      'Do not go below. The thing we buried does not know it is dead, ' +
      'and the icon it clutches is the only thing keeping the ground closed.\n\n' +
      '— If you must pray, pray at the bones.',
  },
  plantingLedger: {
    title: 'THE PLANTING LEDGER',
    body:
      'Row 3: Brother Aldous. Planted shallow. Rose within the week.\n\n' +
      'Row 5: The Verger. Planted with the green key, as he asked, so no ' +
      'one would open the gate while he changed.\n\n' +
      'We do not plant them deep. The warden says the ground is already full.',
  },
  vergerNote: {
    title: 'THE VERGER’S LAST PAGE',
    body:
      'The bell is not for calling the living. It is for telling the ground ' +
      'the hour, so it stays asleep.\n\n' +
      'The icon is the clapper’s heart. Without it the bell only whispers, ' +
      'and the whisper is what woke them.\n\n' +
      'Seat the icon. Ring the hour. Forgive me for keeping the key.',
  },
};

/** Read a document in the world: mark it collected, show the note overlay. */
export function readDocument(events, story, id) {
  const doc = DOCUMENTS[id];
  if (!doc) throw new Error(`Unknown document '${id}'`);
  story.set(`doc:${id}`, true);
  events.emit('ui/show-note', doc);
}

/** Ids of documents the player has read (for the satchel shelf). */
export function collectedDocuments(story) {
  return Object.keys(DOCUMENTS).filter((id) => story.get(`doc:${id}`));
}
