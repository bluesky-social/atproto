import { Kysely } from 'kysely'
import { AppBskyGetAuthorFeed, AppBskyGetHomeFeed } from '@adxp/api'
import { DatabaseSchema } from '../../../db/database-schema'
import * as util from '../../../db/util'

type UserInfo = {
  did: string
  name: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: Kysely<DatabaseSchema>,
  user: string,
): Promise<UserInfo> => {
  const userInfo = await db
    .selectFrom('user')
    .where(util.userWhereClause(user))
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
    .select([
      'user.did as did',
      'user.username as name',
      'profile.displayName as displayName',
    ])
    .executeTakeFirst()
  if (!userInfo) {
    throw new Error(`Could not find entry for user: ${user}`)
  }
  return {
    did: userInfo.did,
    name: userInfo.name,
    displayName: userInfo.displayName || undefined,
  }
}

// @TODO add embeds
// @TODO type this row input
// Present post and repost results into FeedItems
export const queryResultToFeedItem = (
  row,
): AppBskyGetHomeFeed.FeedItem & AppBskyGetAuthorFeed.FeedItem => ({
  cursor: row.cursor,
  uri: row.uri,
  author: {
    did: row.authorDid,
    name: row.authorName,
    displayName: row.authorDisplayName || undefined,
  },
  repostedBy:
    !row.isNotRepost && row.repostedByDid
      ? {
          did: row.repostedByDid,
          name: row.repostedByName,
          displayName: row.repostedByDisplayName || undefined,
        }
      : undefined,
  record: JSON.parse(row.rawRecord),
  replyCount: row.replyCount,
  repostCount: row.repostCount,
  likeCount: row.likeCount,
  indexedAt: row.indexedAt,
  myState: {
    repost: row.requesterRepost || undefined,
    like: row.requesterLike || undefined,
  },
})

export enum FeedAlgorithm {
  Firehose = 'firehose',
  ReverseChronological = 'reverse-chronological',
}

export const isEnum = <T extends { [s: string]: unknown }>(
  object: T,
  possibleValue: unknown,
): possibleValue is T[keyof T] => {
  return Object.values(object).includes(possibleValue)
}
