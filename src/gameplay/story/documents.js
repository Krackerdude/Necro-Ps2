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
  ringersRoll: {
    title: 'THE RINGERS’ ROLL',
    body:
      'Bell-ringers of the parish, in perpetuity:\n\n' +
      'ALDERS, F. — the Dirge, forty years. Retired into the south wall.\n' +
      'COLE, M. — the Mercy. Retired into the south wall.\n' +
      'BRECHT, A. & BRECHT, O. — the Quarrels, cast for the brothers so ' +
      'they would stop fighting over one rope. It did not work.\n\n' +
      'NOTE: ringers are interred with their hands cast in bronze, mid-pull. ' +
      'The tower likes to keep the option open.',
  },
  foundryNote: {
    title: 'THE FOUNDER’S SLATE',
    body:
      'Great Bell recast THRICE. Cracks every time, always the same seam.\n\n' +
      'The bronze is not at fault. The bell cracks the night before every ' +
      'thanksgiving, like a throat clearing itself.\n\n' +
      'The big lad asked to keep the third casting. He wears it. I did not ' +
      'argue. You do not argue with the Tolltaker about bells.',
  },
  wardensRestLog: {
    title: 'THE GUEST LOG, WARDEN’S REST',
    body:
      'One cot, kept made. One bottle, kept full. The tower insists.\n\n' +
      'Guests this century: two.\n\n' +
      'The first slept one night and went up to the carillon whistling. ' +
      'The tower kept the whistle. You can hear it in the chimes on quiet ' +
      'nights, still going up.',
  },
  hymnOfHours: {
    title: 'THE HYMN OF HOURS (NAILED UP, UPSIDE DOWN)',
    body:
      'As sung on thanksgiving, descending:\n\n' +
      'MERCY last of all,\n' +
      'the younger quarrel third,\n' +
      'the elder quarrel second,\n' +
      'and FIRST — always first — the low dark Dirge.\n\n' +
      '(A later hand: the tower nails this page up wrong way round because ' +
      'it thinks that is funny. It is a LITTLE funny. — M.A.)',
  },
  clockPlaque: {
    title: 'THE HOROLOGIST’S PLAQUE',
    body:
      'This movement keeps GRAVEN TIME, which is not the same thing.\n\n' +
      'Strike no hour idly. The wing has ears, and the works announce ' +
      'mistakes at full voice.\n\n' +
      'If you must wake the vault: the verger wrote that the ground sleeps ' +
      'deepest at the THIRD hour. Strike it softly and take what is yours.',
  },
  stacksMemo: {
    title: 'SHELVING MEMO (EDITION TWO)',
    body:
      'To all copyists:\n\n' +
      'The stacks now REARRANGE by catalogue lever. Edition One favors the ' +
      'west passage; Edition Two opens the reading alcove and closes the ' +
      'shortcut — the library cannot bear both truths at once.\n\n' +
      'Do not be in the stacks during a shift. Brother Emmett was in the ' +
      'stacks during a shift. Brother Emmett is now referenced in three ' +
      'places at once.',
  },
  illuminatorsNote: {
    title: 'THE ILLUMINATOR’S NOTE',
    body:
      'They asked me to paint the thanksgiving for the great catechism. ' +
      'Gold leaf for the bell, lampblack for the pit, and for the crowd, ' +
      'the good red.\n\n' +
      'I asked what pigment for the guest. The prior said the guest is not ' +
      'PAINTED, the guest is IMPLIED — you show the circle of the crowd ' +
      'and let the eye fill the middle.\n\n' +
      'I have painted forty-one thanksgivings. I cannot stop filling the ' +
      'middle.',
  },
  misprintConfession: {
    title: 'SCRATCHED INTO THE CELL WALL',
    body:
      'I set one word wrong. ONE.\n\n' +
      'The catechism asks WHAT IS THE GROUND OWED and I set the answer as ' +
      'A REST. It should have been — I will not write it, they scrape the ' +
      'walls here.\n\n' +
      'Forty-one copies went out with my mistake. Forty-one households ' +
      'said A REST at dusk for a season. The ground noticed the shortfall. ' +
      'The census the next spring noticed it too.',
  },
  mothMarginalia: {
    title: 'THE MARGINALIA (a small quick hand)',
    body:
      'notes from the margin walk, in red:\n\n' +
      '— the pale ones cannot read. this is the saddest thing i know.\n' +
      '— sister four sleeps where the scratching man stopped.\n' +
      '— sister seven drowned dry, above the black.\n' +
      '— the counting man is kind. the counted man was kinder.\n' +
      '— when the library breathes in, be a bookmark: thin, patient, ' +
      'exactly where you were left.',
  },
  catechismOfTheGround: {
    title: 'THE CATECHISM OF THE GROUND',
    body:
      'Q. What is beneath the town?\nA. The ground.\n\n' +
      'Q. What is beneath the ground?\nA. The patience of the ground.\n\n' +
      'Q. What does the ground do at the third hour?\nA. It sleeps, and ' +
      'must not be woken idly.\n\n' +
      'Q. What is the ground owed?\nA. ███████\n\n' +
      '(The answer is struck out in every copy. The strike is two words. ' +
      'The first is short. The Censor’s ledger will know the rest.)',
  },
  proofingManual: {
    title: 'THE PROOFING MANUAL',
    body:
      'Every tallow round is PROOFED before it is bound into the ledgers ' +
      'of account: one test firing against the dummy, one stamp.\n\n' +
      'The proofing piece takes a single round. Respect the reload: it is ' +
      'a comma, not a period. The ossuary pattern revolver takes six and ' +
      'is a better argument, but the crypt keeps that one.\n\n' +
      'Do not proof rounds during a shelving shift. Do not proof rounds ' +
      'at the pale ones while they are watched — the round passes clean ' +
      'through a page nobody wrote. Wait for them to move.',
  },
  censorsLedger: {
    title: 'THE CENSOR’S LEDGER OF STRUCK WORDS',
    body:
      'Words struck from the record, this century: 11,041.\n\n' +
      'Item 40: the name of the town before it was Graven. (Filed under ' +
      'MERCY.)\n\n' +
      'Item 41: the catechism’s fourth answer. Two words. Struck from ' +
      'forty-one copies, forty-one households, and one baker’s hymnal.\n' +
      'The strike reads: A █████. Five letters. It stays at every table ' +
      'until it is called for. It is always, eventually, called for.\n\n' +
      '(Below, in a different, very neat hand: “I un-struck this one. ' +
      'Count the places set at any table in this town. — B.L.”)',
  },
  palimpsestReading: {
    title: 'READING THE SCRAPED WALL',
    body:
      'Under the lamp, at an angle, the old mural ghosts through:\n\n' +
      'A first layer: the town, the sea, a sun. Painted joyfully, by ' +
      'someone who had seen all three.\n\n' +
      'A second layer: the same town, the same sea, no sun — a bell where ' +
      'the sun was.\n\n' +
      'The current layer: a circle of figures around a dark middle, and ' +
      'the words THE GROUND IS OWED — the rest scraped down to stone by ' +
      'someone in a hurry to agree.',
  },
  ledgersCount: {
    title: 'BROTHER LEDGER’S OPEN TALLY',
    body:
      'Things counted this week:\n\n' +
      'Pages: all of them. Again.\n' +
      'The pale ones: nine, but they hold still when I look, which is ' +
      'polite of them.\n' +
      'Presses: four. Delay between lever and slam: one breath, held.\n' +
      'Visitors: ONE (1). (!!!)\n' +
      'Places set at every table in Graven, always, no matter how many ' +
      'live in the house: the household, plus one.\n\n' +
      'Plus one. Plus ONE. I keep counting it. It keeps being there.',
  },
  rootAlmanac: {
    title: 'THE CELLAR ALMANAC',
    body:
      'Plant shallow. Harvest patient. And KEEP TO THE PAVING.\n\n' +
      'The soft rows belong to the planted — they swim it like eels and ' +
      'nothing you own will bite them through it. On stone they must come ' +
      'up for air, and up for air they are only parishioners again.\n\n' +
      'The paths are swept every night. Nobody sweeps them. Think about ' +
      'who that leaves.',
  },
  wellRubbing: {
    title: 'A RUBBING FROM THE OLD WELL',
    body:
      'The well predates the church. The church predates the town. The ' +
      'carving on the well predates the language it is in.\n\n' +
      'Best rendering: HERE THE GROUND FIRST ASKED. HERE WE FIRST SAID YES.\n\n' +
      'Below that, much newer, much smaller: two names and a date, ' +
      'sweethearts’ work. People will carve anything on anything.',
  },
  tithingTable: {
    title: 'THE TITHING TABLE',
    body:
      'WEIGHTS AND MEASURES OF THE THANKSGIVING:\n\n' +
      'A fair gift is TWELVE STONE — the weight of a guest, no more, no ' +
      'less. The ground counts a light pan as theft.\n\n' +
      'And it counts a heavy pan as MOCKERY, which is worse. Greed reads ' +
      'as appetite, and the ground answers appetite with appetite.\n\n' +
      'Relics for the weighing are kept in the scale room, marked in ' +
      'stone-units. All but one. Some weights the church prefers not to ' +
      'write down.',
  },
  mouldsSermon: {
    title: 'MOULD’S PINNED SERMON (delivered annually, from the bed)',
    body:
      'Friends. Neighbors. Rows.\n\n' +
      'They call it being buried. I call it being PLANTED, and the ' +
      'difference is everything: buried things are finished, planted ' +
      'things are EXPECTED.\n\n' +
      'The ground is not our enemy. The ground is a landlord. The rent is ' +
      'strange but the tenancy is long, and I have never once been cold.\n\n' +
      '(annotation, Wren’s hand: he waters himself. we’ve stopped arguing.)',
  },
  plantingCalendar: {
    title: 'THE PLANTING CALENDAR',
    body:
      'SPRING: turn the rows. The Gardener does this. Do not help.\n' +
      'SUMMER: the rows settle. Walk the paving only.\n' +
      'AUTUMN: thanksgiving. The Gardener digs the year’s bed the night ' +
      'before, always the right size. Nobody tells him the size.\n' +
      'WINTER: he stands in the hall with his spade and waits. If you ' +
      'must pass in winter, remember: he marks the ground where he will ' +
      'rise. He has never once risen anywhere else. He is very proud of ' +
      'that.',
  },
  seedManifest: {
    title: 'THE SEED VAULT MANIFEST',
    body:
      'Jarred and shelved, per the warden:\n\n' +
      'BARLEY, WINTER — 12 jars.\nRYE, PATIENT — 9 jars.\n' +
      'SEEDS, IRON (tallow rounds) — 2 jars. Everything is a seed if you ' +
      'plant it in the right thing.\n' +
      'KEY, CLOVER, ONE — 1 jar. For the warden’s plot. If you are ' +
      'reading this and you are not the warden, he is past minding.\n\n' +
      'GUESTS — see PLANTING HALL. We do not jar the guests.',
  },
  wormworksNote: {
    title: 'THE TUNNELER’S NOTE',
    body:
      'The tunnels under the hall are not dug. Dug tunnels have tool ' +
      'marks. These have RIBS.\n\n' +
      'I mapped them for the warden: they run from the planting hall down ' +
      'and DOWN, past where my lamp gives up, toward the sunken places. ' +
      'Every tunnel the same shape. Every tunnel a throat.\n\n' +
      'The warden read my map, thanked me, and burned it. “The church ' +
      'grew a gullet,” he said. “Better nobody knows which way it ' +
      'swallows.”',
  },
  wardensPlot: {
    title: 'THE WARDEN’S PLOT LEDGER',
    body:
      'My own garden. My own rules. Behind my own key.\n\n' +
      'Row one: draughts. You bury a vial of the deep vintage and the ' +
      'plot does not grow it — it CONCENTRATES it. The ground tithes ' +
      'everything, even medicine. I take my cut anyway.\n\n' +
      'Row two: salve cuttings. Do not ask the rootstock.\n\n' +
      'Row three is empty. Row three is MINE. A man who caged the key ' +
      'should keep one bed made, in case the ground ever calls his ' +
      'arrangement mockery.\n\n' +
      '(The soil of row three is turned. Recently.)',
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
