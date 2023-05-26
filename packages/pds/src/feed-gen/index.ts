import { AtUri } from '@atproto/uri'
import withFriends from './with-friends'
import bskyTeam from './bsky-team'
import whatsHot from './whats-hot'
import hotClassic from './hot-classic'
import bestOfFollows from './best-of-follows'
import mutuals from './mutuals'
import { ids } from '../lexicon/lexicons'
import { MountedAlgos } from './types'

const coll = ids.AppBskyFeedGenerator

// These are custom algorithms that will be mounted directly onto an AppView
// Feel free to remove, update to your own, or serve the following logic at a record that you control
export const makeAlgos = (did: string): MountedAlgos => ({
  [AtUri.make(did, coll, 'with-friends').toString()]: withFriends,
  [AtUri.make(did, coll, 'bsky-team').toString()]: bskyTeam,
  [AtUri.make(did, coll, 'whats-hot').toString()]: whatsHot,
  [AtUri.make(did, coll, 'hot-classic').toString()]: hotClassic,
  [AtUri.make(did, coll, 'best-of-follows').toString()]: bestOfFollows,
  [AtUri.make(did, coll, 'mutuals').toString()]: mutuals,
})
