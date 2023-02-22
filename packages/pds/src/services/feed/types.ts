import { Presented as PresentedImage } from '../../lexicon/types/app/bsky/embed/images'
import { Presented as PresentedExternal } from '../../lexicon/types/app/bsky/embed/external'
import { Presented as PresentedRecord } from '../../lexicon/types/app/bsky/embed/record'

export type FeedEmbeds = {
  [uri: string]: PresentedImage | PresentedExternal | PresentedRecord
}

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  recordBytes: Uint8Array
  indexedAt: string
  upvoteCount: number
  downvoteCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterUpvote: string | null
  requesterDownvote: string | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export type ActorView = {
  did: string
  declaration: {
    cid: string
    actorType: string
  }
  handle: string
  displayName?: string
  avatar?: string
  viewer?: { muted: boolean }
}
export type ActorViewMap = { [did: string]: ActorView }

export type FeedItemType = 'post' | 'repost'

export type FeedRow = {
  type: FeedItemType
  postUri: string
  postCid: string
  originatorDid: string
  authorDid: string
  replyParent: string | null
  replyRoot: string | null
  cursor: string
}
