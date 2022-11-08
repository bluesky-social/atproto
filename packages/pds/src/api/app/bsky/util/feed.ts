import * as common from '@atproto/common'
import * as GetAuthorFeed from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import * as GetTimeline from '../../../../lexicon/types/app/bsky/feed/getTimeline'

// Present post and repost results into FeedItems
// @TODO add embeds
export const rowToFeedItem = (row: FeedRow): FeedItem => ({
  uri: row.postUri,
  cid: row.postCid,
  author: {
    did: row.authorDid,
    handle: row.authorHandle,
    displayName: row.authorDisplayName ?? undefined,
  },
  repostedBy:
    row.type === 'repost'
      ? {
          did: row.originatorDid,
          handle: row.originatorHandle,
          displayName: row.originatorDisplayName ?? undefined,
        }
      : undefined,
  record: common.ipldBytesToRecord(row.recordBytes),
  replyCount: row.replyCount,
  repostCount: row.repostCount,
  upvoteCount: row.upvoteCount,
  downvoteCount: row.downvoteCount,
  indexedAt: row.indexedAt,
  myState: {
    repost: row.requesterRepost ?? undefined,
    upvote: row.requesterUpvote ?? undefined,
    downvote: row.requesterDownvote ?? undefined,
  },
})

export enum FeedAlgorithm {
  Firehose = 'firehose',
  ReverseChronological = 'reverse-chronological',
}

type FeedItem = GetAuthorFeed.FeedItem & GetTimeline.FeedItem

type FeedRow = {
  type: 'post' | 'repost'
  postUri: string
  postCid: string
  cursor: string
  recordBytes: Uint8Array
  indexedAt: string
  authorDid: string
  authorHandle: string
  authorDisplayName: string | null
  originatorDid: string
  originatorHandle: string
  originatorDisplayName: string | null
  upvoteCount: number
  downvoteCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterUpvote: string | null
  requesterDownvote: string | null
}
