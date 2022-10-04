import { TodoSocialGetAuthorFeed, TodoSocialGetHomeFeed } from '@adxp/api'
import { DataSource, SelectQueryBuilder } from 'typeorm'
import { AdxRecord } from '../../../db/record'
import { LikeIndex } from '../../../db/records/like'
import { PostIndex } from '../../../db/records/post'
import { ProfileIndex } from '../../../db/records/profile'
import { RepostIndex } from '../../../db/records/repost'
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

// Determine result set of posts and reposts
export const queryPostsWithReposts = (qb: SelectQueryBuilder<PostIndex>) => {
  return qb
    .leftJoin(RepostIndex, 'repost', 'repost.subject = post.uri')
    .leftJoin(
      User,
      'originator',
      'originator.did = post.creator OR originator.did = repost.creator',
    )
}

// Select data for presentation of posts and reposts into FeedItems.
// NOTE ensure each join matches 0 or 1 rows, does not cause duplication of (re-)posts.
export const queryPostsAndRepostsAsFeedItems = (
  qb: SelectQueryBuilder<PostIndex>,
  { requester },
) => {
  return qb
    .select([
      'post.uri AS uri',
      'author.did AS authorDid',
      'author.username AS authorName',
      'author_profile.displayName AS authorDisplayName',
      'reposted_by.did AS repostedByDid',
      'reposted_by.username AS repostedByName',
      'reposted_by_profile.displayName AS repostedByDisplayName',
      `${util.isNotRepostClause} AS isNotRepost`,
      'record.raw AS rawRecord',
      'like_count.count AS likeCount',
      'repost_count.count AS repostCount',
      'reply_count.count AS replyCount',
      'requester_repost.uri AS requesterRepost',
      'requester_like.uri AS requesterLike',
      'record.indexedAt AS indexedAt',
      `${util.postOrRepostIndexedAtClause} as cursor`,
    ])
    .leftJoin(User, 'author', 'author.did = post.creator')
    .leftJoin(
      ProfileIndex,
      'author_profile',
      'author_profile.creator = author.did',
    )
    .leftJoin(User, 'reposted_by', 'reposted_by.did = repost.creator')
    .leftJoin(
      ProfileIndex,
      'reposted_by_profile',
      'reposted_by_profile.creator = reposted_by.did',
    )
    .leftJoin(AdxRecord, 'record', 'record.uri = post.uri')
    .leftJoin(
      util.countSubquery(LikeIndex, 'subject'),
      'like_count',
      'like_count.subject = post.uri',
    )
    .leftJoin(
      util.countSubquery(RepostIndex, 'subject'),
      'repost_count',
      'repost_count.subject = post.uri',
    )
    .leftJoin(
      util.countSubquery(PostIndex, 'replyParent'),
      'reply_count',
      'reply_count.subject = post.uri',
    )
    .leftJoin(
      RepostIndex,
      'requester_repost',
      `requester_repost.creator = :requester AND requester_repost.subject = post.uri`,
      { requester },
    )
    .leftJoin(
      LikeIndex,
      'requester_like',
      `requester_like.creator = :requester AND requester_like.subject = post.uri`,
      { requester },
    )
}

// @TODO add embeds
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
