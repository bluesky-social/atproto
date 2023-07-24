import { RepoRecord } from '@atproto/lexicon'
import { View as ImagesEmbedView } from '../../../lexicon/types/app/bsky/embed/images'
import { View as ExternalEmbedView } from '../../../lexicon/types/app/bsky/embed/external'
import {
  ViewBlocked,
  ViewNotFound,
  ViewRecord,
  View as RecordEmbedView,
} from '../../../lexicon/types/app/bsky/embed/record'
import { View as RecordWithMediaEmbedView } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  BlockedPost,
  GeneratorView,
  NotFoundPost,
  PostView,
} from '../../../lexicon/types/app/bsky/feed/defs'
import { Label } from '../../../lexicon/types/com/atproto/label/defs'
import { FeedGenerator } from '../../db/tables/feed-generator'
import { ListView } from '../../../lexicon/types/app/bsky/graph/defs'

export type PostEmbedViews = {
  [uri: string]: PostEmbedView
}

export type PostEmbedView =
  | ImagesEmbedView
  | ExternalEmbedView
  | RecordEmbedView
  | RecordWithMediaEmbedView

export type PostViews = { [uri: string]: PostView }

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  record: RepoRecord
  indexedAt: string
  likeCount: number | null
  repostCount: number | null
  replyCount: number | null
  requesterRepost: string | null
  requesterLike: string | null
  takedownId: number | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export type PostBlocksMap = {
  [uri: string]: { reply?: boolean; embed?: boolean }
}

export type ActorInfo = {
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
export type ActorInfoMap = { [did: string]: ActorInfo }

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
export type FeedHydrationOptions = {
  includeSoftDeleted?: boolean
  usePostViewUnion?: boolean
}

export type MaybePostView = PostView | NotFoundPost | BlockedPost

export type RecordEmbedViewRecord =
  | ViewRecord
  | ViewNotFound
  | ViewBlocked
  | GeneratorView
  | ListView

export type RecordEmbedViewRecordMap = { [uri: string]: RecordEmbedViewRecord }
