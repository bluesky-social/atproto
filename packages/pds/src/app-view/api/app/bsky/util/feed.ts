import { TimeCidKeyset } from '../../../../../db/pagination'
import { SkeletonFeedPost } from '../../../../../lexicon/types/app/bsky/feed/defs'
import { FeedRow } from '../../../../services/feed'

export const feedRowsToSkeleton = (rows: FeedRow[]): SkeletonFeedPost[] => {
  return rows.map((row) => {
    const post: SkeletonFeedPost = { post: row.postUri }
    if (row.type === 'repost') {
      post.reason = {
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        by: row.originatorDid,
        indexedAt: row.sortAt,
      }
    }
    if (row.replyRoot && row.replyParent) {
      post.replyTo = {
        root: row.replyRoot,
        parent: row.replyParent,
      }
    }
    return post
  })
}

export enum FeedAlgorithm {
  ReverseChronological = 'reverse-chronological',
}

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.sortAt, secondary: result.cid }
  }
}
