import * as common from '@atproto/common'
import * as GetAuthorFeed from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import * as GetTimeline from '../../../../lexicon/types/app/bsky/feed/getTimeline'

// Present post and repost results into FeedItems
// @TODO add embeds
export const rowToFeedItem = (row: FeedRow): FeedItem => ({
  uri: row.postUri,
  cid: row.postCid,
  author: rowToAuthor(row),
  trendedBy: row.type === 'trend' ? rowToOriginator(row) : undefined,
  repostedBy: row.type === 'repost' ? rowToOriginator(row) : undefined,
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

const rowToAuthor = (row: FeedRow) => ({
  did: row.authorDid,
  handle: row.authorHandle,
  actorType: row.authorActorType,
  displayName: row.authorDisplayName ?? undefined,
})

const rowToOriginator = (row: FeedRow) => ({
  did: row.originatorDid,
  handle: row.originatorHandle,
  actorType: row.originatorActorType,
  displayName: row.originatorDisplayName ?? undefined,
})

export enum FeedAlgorithm {
  Firehose = 'firehose',
  ReverseChronological = 'reverse-chronological',
}

type FeedItem = GetAuthorFeed.FeedItem & GetTimeline.FeedItem

export type FeedItemType = 'post' | 'repost' | 'trend'

type FeedRow = {
  type: FeedItemType
  postUri: string
  postCid: string
  cursor: string
  recordBytes: Uint8Array
  indexedAt: string
  authorDid: string
  authorHandle: string
  authorActorType: string
  authorDisplayName: string | null
  originatorDid: string
  originatorHandle: string
  originatorActorType: string
  originatorDisplayName: string | null
  upvoteCount: number
  downvoteCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterUpvote: string | null
  requesterDownvote: string | null
}
