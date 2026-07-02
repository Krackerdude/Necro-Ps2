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
const CHAIN = [
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
