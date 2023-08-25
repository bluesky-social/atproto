import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'
import withFriends from './with-friends'
import bskyTeam from './bsky-team'
import hotClassic from './hot-classic'
import bestOfFollows from './best-of-follows'
import mutuals from './mutuals'
import { MountedAlgos } from './types'

const feedgenUri = (did, name) =>
  AtUri.make(did, ids.AppBskyFeedGenerator, name).toString()

// These are custom algorithms that will be mounted directly onto an AppView
// Feel free to remove, update to your own, or serve the following logic at a record that you control
export const makeAlgos = (did: string): MountedAlgos => ({
  [feedgenUri(did, 'with-friends')]: withFriends,
  [feedgenUri(did, 'bsky-team')]: bskyTeam,
  [feedgenUri(did, 'hot-classic')]: hotClassic,
  [feedgenUri(did, 'best-of-follows')]: bestOfFollows,
  [feedgenUri(did, 'mutuals')]: mutuals,
})
