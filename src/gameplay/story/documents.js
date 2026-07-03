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
  mikesLetter: {
    title: 'MIKE\u2019S LETTER',
    body:
      'You\u2019ll think I\u2019ve lost it. Maybe. But I found the place, the one from ' +
      'grandad\u2019s stories \u2014 GRAVEN, it\u2019s real, it\u2019s on no map printed after \u201951.\n\n' +
      'It\u2019s beautiful here. That\u2019s the part I can\u2019t get past. The bread, the ' +
      'light on the harbor, the way everyone knows your name by the second ' +
      'morning. Nobody leaves. I\u2019ve stopped asking why nobody leaves.\n\n' +
      'There\u2019s a church on the hill. They ring the bell at dusk and everyone ' +
      'goes inside and I have started to want to go with them, which is why ' +
      'you have to come. Come before I stop writing letters.\n\n' +
      '\u2014 M.',
  },
  mikesJournal: {
    title: 'MIKE’S JOURNAL — THE LAST PAGE',
    body:
      'Developed the churchyard roll in the washbasin. Sixty-one went up ' +
      'the hill at the bell. I counted them in from the point. I counted ' +
      'them out. Sixty.\n\n' +
      'Did it again the next dusk. Sixty out, fifty-nine home. The town is ' +
      'a tide that always comes in one short, and nobody on the pier ever ' +
      'mentions the sea.\n\n' +
      'Callum watched me photograph the doors today. He was very kind ' +
      'about it. He is very kind about everything. That is the thing I ' +
      'cannot get past anymore.\n\n' +
      'If someone finds this: the pictures are with the one person here ' +
      'who told me to burn them.',
  },
  cagePlaque: {
    title: 'THE CAGE, ITS RUBRIC',
    body:
      'THREE STONES, THREE WITNESSES:\n\n' +
      'The HOUR, from the tower wing, which counts what the town owes.\n' +
      'The WORD, from the scriptorium wing, which records who agreed.\n' +
      'The GROUND, from the undercroft wing, which collects.\n\n' +
      'Seat all three and the cage will open, and God forgive whoever ' +
      'needs it to.',
  },
  townNotice: {
    title: 'PARISH NOTICE',
    body:
      'BY ORDER OF THE PARISH:\n\n' +
      'The evening bell will ring at dusk, as it has, as it must.\n\n' +
      'All doors to be shut by last light. Visitors are the responsibility ' +
      'of their hosts.\n\n' +
      'The harvest thanksgiving is moved forward again this year. The ground ' +
      'is generous, and generosity must be answered promptly.',
  },
  harborLedger: {
    title: 'HARBOR LEDGER',
    body:
      'Arrivals, this season: eleven.\n\n' +
      'Departures, this season: (the column is ruled, inked, and empty)\n\n' +
      'A later hand, smaller: He asks me why the column is empty. I tell him ' +
      'the truth \u2014 nobody who comes for the festival ever wants to miss the ' +
      'next one.',
  },
  wardenNote: {
    title: 'THE WARDEN’S NOTE',
    body:
      'If you are reading this, the town let you in and the church let you ' +
      'no further. I was Graven’s warden before Callum wore the collar. ' +
      'I nailed these doors myself, from this side, the year I understood ' +
      'what the thanksgiving feeds.\n\n' +
      'I keep the black key upon the altar, caged. The hours, the words, and ' +
      'the ground must all agree before it moves again — I quarried a stone ' +
      'from each wing to make sure they never would.\n\n' +
      'Do not go below. The thing we buried under the garth does not know ' +
      'it is dead, and the icon it clutches is the only thing keeping the ' +
      'ground closed. The town above sings to it once a year so it will ' +
      'stay asleep. The pit is how they apologize.\n\n' +
      '— If you must pray, pray at the bones.',
  },
  plantingLedger: {
    title: 'THE PLANTING LEDGER',
    body:
      'Row 3: Brother Aldous. Planted shallow. Rose within the week.\n\n' +
      'Row 5: The Verger. Planted with the green key, as he asked, so no ' +
      'one would open the gate while he changed.\n\n' +
      'We do not plant them deep. The warden says the ground is already full.\n\n' +
      'A newer hand, unpracticed:\n' +
      'Row 9: the visitor with the camera. He asked to see below the church. ' +
      'Given at thanksgiving, whole and thankful. He is still seeing.',
  },
  vergerNote: {
    title: 'THE VERGER’S LAST PAGE',
    body:
      'The bell is not for calling the living. It is for telling the ground ' +
      'the hour, so it stays asleep.\n\n' +
      'The dusk bell in the tower is only its echo — the town rings the echo ' +
      'and calls it custom, and feeds the pit and calls it thanks. This one, ' +
      'down here, is the true bell. The icon is the clapper’s heart. Without ' +
      'it the bell only whispers, and the whisper is what woke them.\n\n' +
      'Seat the icon. Ring the hour. It puts everything back to sleep — the ' +
      'ground, the planted, the whole hungry arrangement above.\n\n' +
      'Forgive me for keeping the key.',
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
