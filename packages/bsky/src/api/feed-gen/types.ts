import AppContext from '../../context'
import { SkeletonFeedPost } from '../../lexicon/types/app/bsky/feed/defs'
import { QueryParams as SkeletonParams } from '../../lexicon/types/app/bsky/feed/getFeedSkeleton'

export type AlgoResponseItem = {
  itemUri: string
  postUri: string
}

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
  cursor?: string
}

export type AlgoHandler = (
  ctx: AppContext,
  params: SkeletonParams,
  viewer: string | null,
) => Promise<AlgoResponse>

export type MountedAlgos = Record<string, AlgoHandler>

export const toSkeletonItem = (feedItem: {
  itemUri: string
  postUri: string
}): SkeletonFeedPost => ({
  post: feedItem.postUri,
  reason:
    feedItem.itemUri === feedItem.postUri
      ? undefined
      : {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
          repost: feedItem.itemUri,
        },
})
