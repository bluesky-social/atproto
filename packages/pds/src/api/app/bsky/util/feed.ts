import * as common from '@atproto/common'
import * as GetAuthorFeed from '../../../../lexicon/types/app/bsky/getAuthorFeed'
import * as GetTimeline from '../../../../lexicon/types/app/bsky/getTimeline'

// Present post and repost results into FeedItems
// @TODO add embeds
export const rowToFeedItem = (row: FeedRow): FeedItem => ({
  uri: row.postUri,
  cid: row.postCid,
  author: {
    did: row.authorDid,
    name: row.authorName,
    displayName: row.authorDisplayName ?? undefined,
  },
  repostedBy:
    row.type === 'repost'
      ? {
          did: row.originatorDid,
          name: row.originatorName,
          displayName: row.originatorDisplayName ?? undefined,
        }
      : undefined,
  record: common.ipldBytesToRecord(row.recordBytes),
  replyCount: row.replyCount,
  repostCount: row.repostCount,
  likeCount: row.likeCount,
  indexedAt: row.indexedAt,
  myState: {
    repost: row.requesterRepost ?? undefined,
    like: row.requesterLike ?? undefined,
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
  authorName: string
  authorDisplayName: string | null
  originatorDid: string
  originatorName: string
  originatorDisplayName: string | null
  likeCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterLike: string | null
}
