import { Selectable } from 'kysely'
import {
  BlockedPost,
  NotFoundPost,
  PostView,
} from '../../lexicon/types/app/bsky/feed/defs'
import { FeedGenerator } from '../../db/tables/feed-generator'

export type FeedGenInfo = Selectable<FeedGenerator> & {
  likeCount: number
  viewerLike: string | null
}

export type FeedGenInfoMap = { [uri: string]: FeedGenInfo }

export type MaybePostView = PostView | NotFoundPost | BlockedPost
