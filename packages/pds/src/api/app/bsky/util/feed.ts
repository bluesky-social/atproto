import * as common from '@atproto/common'
import { getDeclaration } from '.'
import { TimeCidKeyset } from '../../../../db/pagination'
import * as GetAuthorFeed from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import * as GetTimeline from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder } from '../../../../image/uri'

// Present post and repost results into FeedItems
// @TODO add embeds
export const rowToFeedItem =
  (imgUriBuilder: ImageUriBuilder) =>
  (row: FeedRow): FeedItem => ({
    uri: row.postUri,
    cid: row.postCid,
    author: rowToAuthor(imgUriBuilder, row),
    trendedBy:
      row.type === 'trend' ? rowToOriginator(imgUriBuilder, row) : undefined,
    repostedBy:
      row.type === 'repost' ? rowToOriginator(imgUriBuilder, row) : undefined,
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

const rowToAuthor = (imgUriBuilder: ImageUriBuilder, row: FeedRow) => ({
  did: row.authorDid,
  declaration: getDeclaration('author', row),
  handle: row.authorHandle,
  displayName: row.authorDisplayName ?? undefined,
  avatar: row.authorAvatarCid
    ? imgUriBuilder.getCommonSignedUri('avatar', row.authorAvatarCid)
    : undefined,
})

const rowToOriginator = (imgUriBuilder: ImageUriBuilder, row: FeedRow) => ({
  did: row.originatorDid,
  declaration: getDeclaration('originator', row),
  handle: row.originatorHandle,
  displayName: row.originatorDisplayName ?? undefined,
  avatar: row.originatorAvatarCid
    ? imgUriBuilder.getSignedUri({
        cid: CID.parse(row.originatorAvatarCid),
        format: 'jpeg',
        fit: 'cover',
        height: 250,
        width: 250,
        min: true,
      })
    : undefined,
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
  authorDeclarationCid: string
  authorActorType: string
  authorHandle: string
  authorDisplayName: string | null
  authorAvatarCid: string | null
  originatorDid: string
  originatorDeclarationCid: string
  originatorActorType: string
  originatorHandle: string
  originatorDisplayName: string | null
  originatorAvatarCid: string | null
  upvoteCount: number
  downvoteCount: number
  repostCount: number
  replyCount: number
  requesterRepost: string | null
  requesterUpvote: string | null
  requesterDownvote: string | null
}

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.cursor, secondary: result.postCid }
  }
}
