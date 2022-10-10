import { TodoSocialGetAuthorFeed, TodoSocialGetHomeFeed } from '@adxp/api'
import { DataSource } from 'typeorm'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import * as util from '../../../db/util'

type UserInfo = {
  did: string
  name: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: DataSource,
  user: string,
): Promise<UserInfo> => {
  const userInfo = await db
    .createQueryBuilder()
    .select([
      'user.did AS did',
      'user.username AS name',
      'profile.displayName AS displayName',
    ])
    .from(User, 'user')
    .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
    .where(util.userWhereClause(user), { user })
    .getRawOne()
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
): TodoSocialGetHomeFeed.FeedItem & TodoSocialGetAuthorFeed.FeedItem => ({
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
  replyCount: row.replyCount || 0,
  repostCount: row.repostCount || 0,
  likeCount: row.likeCount || 0,
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
