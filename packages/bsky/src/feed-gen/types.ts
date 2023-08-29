import AppContext from '../context'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'
import { QueryParams as SkeletonParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

export type AlgoResponse = {
  feed: SkeletonFeedPost[]
  cursor?: string
}

export type AlgoHandler = (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
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
