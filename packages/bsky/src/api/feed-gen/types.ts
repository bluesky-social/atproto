import AppContext from '../../context'
import { FeedItem } from '../../hydration/feed'
import { SkeletonFeedPost } from '../../lexicon/types/app/bsky/feed/defs'
import { QueryParams as SkeletonParams } from '../../lexicon/types/app/bsky/feed/getFeedSkeleton'

export type AlgoResponseItem = {
  itemUri: string
  postUri: string
}

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
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

export const toFeedItem = (feedItem: AlgoResponseItem): FeedItem => ({
  post: { uri: feedItem.postUri },
  repost:
    feedItem.itemUri === feedItem.postUri
      ? undefined
      : { uri: feedItem.itemUri },
})
