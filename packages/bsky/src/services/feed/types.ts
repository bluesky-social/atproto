import { Selectable } from 'kysely'
import { Record as ThreadgateRecord } from '../../lexicon/types/app/bsky/feed/threadgate'
import { View as ImagesEmbedView } from '../../lexicon/types/app/bsky/embed/images'
import { View as ExternalEmbedView } from '../../lexicon/types/app/bsky/embed/external'
import {
  ViewBlocked,
  ViewNotFound,
  ViewRecord,
  View as RecordEmbedView,
} from '../../lexicon/types/app/bsky/embed/record'
import { View as RecordWithMediaEmbedView } from '../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  BlockedPost,
  GeneratorView,
  NotFoundPost,
  PostView,
} from '../../lexicon/types/app/bsky/feed/defs'
import { FeedGenerator } from '../../db/tables/feed-generator'
import { ListView } from '../../lexicon/types/app/bsky/graph/defs'
import { ProfileHydrationState } from '../actor'
import { Labels } from '../label'
import { BlockAndMuteState } from '../graph'

export type PostEmbedViews = {
  [uri: string]: PostEmbedView
}

export type PostEmbedView =
  | ImagesEmbedView
  | ExternalEmbedView
  | RecordEmbedView
  | RecordWithMediaEmbedView

export type PostInfo = {
  uri: string
  cid: string
  creator: string
  record: Record<string, unknown>
  indexedAt: string
  likeCount: number | null
  repostCount: number | null
  replyCount: number | null
  requesterRepost: string | null
  requesterLike: string | null
  invalidReplyRoot: boolean
  violatesThreadGate: boolean
  viewer: string | null
}

export type PostInfoMap = { [uri: string]: PostInfo }

export type PostBlocksMap = {
  [uri: string]: { reply?: boolean; embed?: boolean }
}

export type ThreadgateInfo = {
  uri: string
  cid: string
  record: ThreadgateRecord
}

export type ThreadgateInfoMap = {
  [postUri: string]: ThreadgateInfo
}

export type FeedGenInfo = Selectable<FeedGenerator> & {
  likeCount: number
  viewer?: {
    like?: string
  }
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

export type RecordEmbedViewRecord =
  | ViewRecord
  | ViewNotFound
  | ViewBlocked
  | GeneratorView
  | ListView

export type RecordEmbedViewRecordMap = { [uri: string]: RecordEmbedViewRecord }

export type FeedHydrationState = ProfileHydrationState & {
  posts: PostInfoMap
  threadgates: ThreadgateInfoMap
  embeds: PostEmbedViews
  labels: Labels
  blocks: PostBlocksMap
  bam: BlockAndMuteState
}
