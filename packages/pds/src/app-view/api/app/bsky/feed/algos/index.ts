import { AtUri } from '@atproto/uri'
import skyline from './skyline'
import bskyTeam from './bsky-team'
import whatsHotClassic from './whats-hot-classic'
import { ids } from '../../../../../../lexicon/lexicons'
import { AlgoHandler } from './types'

const did = 'did:plc:z72i7hdynmk6r22z27h6tvur'
const coll = ids.AppBskyFeedGenerator

const algos: Record<string, AlgoHandler> = {
  [AtUri.make(did, coll, 'skyline').toString()]: skyline,
  [AtUri.make(did, coll, 'bsky-team').toString()]: bskyTeam,
  [AtUri.make(did, coll, 'whats-hot-classic').toString()]: whatsHotClassic,
}

export default algos
