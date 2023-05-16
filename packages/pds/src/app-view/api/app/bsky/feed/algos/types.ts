import AppContext from '../../../../../../context'
import { QueryParams as SkeletonParams } from '@atproto/api/src/client/types/app/bsky/feed/getFeedSkeleton'
import { FeedRow } from '../../../../../services/feed'

export type AlgoResponse = {
  feedItems: FeedRow[]
  cursor?: string
}

export type AlgoHandler = (
  ctx: AppContext,
  params: SkeletonParams,
  requester: string,
) => Promise<AlgoResponse>
