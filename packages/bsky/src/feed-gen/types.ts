import AppContext from '../context'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { FeedRow } from '../services/feed'

export type AlgoResponse = {
  feedItems: FeedRow[]
  resHeaders?: Record<string, string>
  cursor?: string
}

export type AlgoHandler = (
  ctx: AppContext,
  params: SkeletonParams,
  viewer: string | null,
) => Promise<AlgoResponse>

export type MountedAlgos = Record<string, AlgoHandler>

export const toSkeletonItem = (feedItem: {
  uri: string
  postUri: string
}): SkeletonFeedPost => ({
  post: feedItem.postUri,
  reason:
    feedItem.uri === feedItem.postUri
      ? undefined
      : {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
          repost: feedItem.uri,
        },
})
