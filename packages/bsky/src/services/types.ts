import { View as ViewImages } from '../lexicon/types/app/bsky/embed/images'
import { View as ViewExternal } from '../lexicon/types/app/bsky/embed/external'
import { View as ViewRecord } from '../lexicon/types/app/bsky/embed/record'
import { View as ViewRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'

export type FeedEmbeds = {
  [uri: string]: ViewImages | ViewExternal | ViewRecord | ViewRecordWithMedia
}

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  recordJson: string
  indexedAt: string
  likeCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterLike: string | null
  viewer: string | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export type ActorView = {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  viewer?: { muted?: boolean; following?: string; followedBy?: string }
}
export type ActorViewMap = { [did: string]: ActorView }

export type FeedItemType = 'post' | 'repost'

export type FeedRow = {
  type: FeedItemType
  uri: string
  cid: string
  postUri: string
  postAuthorDid: string
  originatorDid: string
  replyParent: string | null
  replyRoot: string | null
  sortAt: string
}
