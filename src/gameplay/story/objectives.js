/**
 * Objective chain — the "what now" of the whole arc, as data.
 *
 * Ordered list; the current objective is the FIRST entry whose `done`
 * predicate is false. Each predicate reads only story flags / inventory, so
 * this needs no wiring into gameplay systems — the HUD recomputes whenever
 * flags or inventory change.
 *
 * When new story beats are added, extend this list (and nothing else).
 */
// The town act ends when you sleep; legacy saves (which predate the town)
// already carry the chapel's visited flag, so every town step also counts
// itself done for them.
const townOver = (story) =>
  Boolean(story.get('sleptAtInn') || story.get('visited:chapel-of-the-hollow'));

const CHAIN = [
  /* ------------------------- ACT I: THE TOWN ------------------------- */
  {
    id: 'car-things',
    text: 'Collect your things from the car',
    done: ({ story, inventory }) =>
      Boolean(inventory?.has('mikesPhotograph') || story.get('took:car-photograph')) ||
      townOver(story),
  },
  {
    id: 'ask-around',
    text: 'Show Mike’s photograph around town',
    done: ({ story }) => Boolean(story.get('quest:rosa')) || townOver(story),
  },
  {
    id: 'ask-inn',
    text: 'Ask at the inn — Rosa says Mike took a room there',
    done: ({ story }) => Boolean(story.get('quest:inn')) || townOver(story),
  },
  {
    id: 'ask-harbor',
    text: 'Find the harbormaster — Mike never boarded a boat out',
    done: ({ story }) => Boolean(story.get('quest:harbor')) || townOver(story),
  },
  {
    id: 'ask-lighthouse',
    text: 'Walk out to the lighthouse and ask the keeper',
    done: ({ story }) => Boolean(story.get('quest:lighthouse')) || townOver(story),
  },
  {
    id: 'ask-priest',
    text: 'Climb to the church — the keeper says Mike watched it for days',
    done: ({ story }) => Boolean(story.get('quest:priest')) || townOver(story),
  },
  {
    id: 'rest-inn',
    text: 'Dusk is falling. Take your room at the inn',
    done: ({ story }) => townOver(story),
  },

  /* ------------------------ THE NIGHT OF GRAVEN ----------------------- */
  // These only surface after 'nightfall' (everything above is done by then)
  // and complete themselves for saves that are already below.
  {
    id: 'night-anyone',
    text: 'The town is empty. Find anyone',
    done: ({ story }) =>
      Boolean(story.get('mikeSeen') || story.get('chaseStarted')) ||
      Boolean(story.get('visited:chapel-of-the-hollow')),
  },
  {
    id: 'night-church',
    text: 'He was pointing at the church',
    done: ({ story }) =>
      Boolean(story.get('chaseStarted')) || Boolean(story.get('visited:chapel-of-the-hollow')),
  },
  {
    id: 'night-run',
    text: 'RUN — THE CHURCH DOORS',
    done: ({ story }) => Boolean(story.get('visited:chapel-of-the-hollow')),
  },

  /* ---------------------- ACT II: BELOW THE TOWN --------------------- */
  {
    id: 'find-key',
    text: 'Search the chapel for a way into the crypt',
    done: ({ story, inventory }) =>
      Boolean(inventory?.has('blackIronKey') || story.get('hasCryptKey') || story.get('cryptDoorOpen')),
  },
  {
    id: 'open-crypt',
    text: 'Unlock the crypt door east of the nave',
    done: ({ story }) => Boolean(story.get('cryptDoorOpen')),
  },
  {
    id: 'take-icon',
    text: 'Take what the dead one guards',
    done: ({ story }) => Boolean(story.get('hasHollowIcon')),
  },
  {
    id: 'descend',
    text: 'Descend the opened stair',
    done: ({ story }) => Boolean(story.get('visited:sunken-cloister')),
  },
  {
    id: 'find-green-key',
    text: 'Find the green key somewhere in the drowned garth',
    done: ({ story, inventory }) =>
      Boolean(inventory?.has('verdigrisKey') || story.get('cloisterGateOpen')),
  },
  {
    id: 'open-gate',
    text: 'Unlock the ossuary gate on the south walk',
    done: ({ story }) => Boolean(story.get('cloisterGateOpen')),
  },
  {
    id: 'reach-bell',
    text: 'Go below — find the bell the verger wrote of',
    done: ({ story }) => Boolean(story.get('visited:ossuary-of-the-hollow')),
  },
  {
    id: 'seat-icon',
    text: 'Seat the Hollow Icon beneath the bell',
    done: ({ story }) => Boolean(story.get('iconSeated')),
  },
  {
    id: 'ring-bell',
    text: 'Ring the hour',
    done: ({ story }) => Boolean(story.get('bellRung')),
  },
  {
    id: 'rest',
    text: 'It is done. The ground sleeps. (End of this build)',
    done: () => false,
  },
];

/**
 * @param {{ story: object, inventory: object | null }} state
 * @returns {{ id: string, text: string }}
 */
export function getCurrentObjective(state) {
  for (const step of CHAIN) {
    if (!step.done(state)) return { id: step.id, text: step.text };
  }
  return CHAIN[CHAIN.length - 1];
}
