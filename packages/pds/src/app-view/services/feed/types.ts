import { View as ViewImages } from '../../../lexicon/types/app/bsky/embed/images'
import { View as ViewExternal } from '../../../lexicon/types/app/bsky/embed/external'
import { View as ViewRecord } from '../../../lexicon/types/app/bsky/embed/record'
import { View as ViewRecordWithMedia } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  BlockedPost,
  NotFoundPost,
  PostView,
} from '../../../lexicon/types/app/bsky/feed/defs'
import { Label } from '../../../lexicon/types/com/atproto/label/defs'
import { FeedGenerator } from '../../db/tables/feed-generator'

export type FeedEmbeds = {
  [uri: string]: ViewImages | ViewExternal | ViewRecord | ViewRecordWithMedia
}

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  recordBytes: Uint8Array
  indexedAt: string
  likeCount: number | null
  repostCount: number | null
  replyCount: number | null
  requesterRepost: string | null
  requesterLike: string | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export type ActorView = {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  viewer?: {
    muted?: boolean
    blockedBy?: boolean
    blocking?: string
    following?: string
    followedBy?: string
  }
  labels?: Label[]
}
export type ActorViewMap = { [did: string]: ActorView }

export type FeedGenInfo = FeedGenerator & {
  likeCount: number
  viewerLike: string | null
}

export type FeedGenInfoMap = { [uri: string]: FeedGenInfo }

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

export type MaybePostView = PostView | NotFoundPost | BlockedPost
