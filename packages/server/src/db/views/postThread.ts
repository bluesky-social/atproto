import { PostThreadView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { PostIndex } from '../records/post'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import * as util from '../util'
import { DbViewPlugin } from '../types'
import { LikeIndex } from '../records/like'
import { RepostIndex } from '../records/repost'
import { AdxRecord } from '../record'

const viewId = 'blueskyweb.xyz:PostThreadView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is PostThreadView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (
    params: Record<string, unknown>,
    requester: string,
  ): Promise<PostThreadView.Response> => {
    if (params['depth']) {
      params['depth'] = parseInt(params['depth'] as string)
    }
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }

    const { uri, depth = 1 } = params

    const res = await postInfoBuilder(db, requester)
      .where('post.uri = :uri', {
        uri,
      })
      .getRawOne()

    let thread = rowToPost(res)
    if (depth > 0) {
      thread.replies = await getReplies(db, thread, depth - 1, requester)
    }
    if (res.parent !== null) {
      const parentRes = await postInfoBuilder(db, requester).where(
        'post.uri = :uri',
        { uri: res.parent },
      )
      thread.parent = rowToPost(parentRes)
    }

    return { thread }
  }

const getReplies = async (
  db: DataSource,
  parent: PostThreadView.Post,
  depth: number,
  requester: string,
): Promise<PostThreadView.Post[]> => {
  const res = await postInfoBuilder(db, requester)
    .where('post.replyParent = :uri', { uri: parent.uri })
    .orderBy('post.createdAt', 'DESC')
    .getRawMany()
  const got = await Promise.all(
    res.map(async (row) => {
      const post = rowToPost(row, parent)
      if (depth > 0) {
        post.replies = await getReplies(db, post, depth - 1, requester)
      }
      return post
    }),
  )
  return got
}

// selects all the needed info about a post, just need to supply the `where` clause
const postInfoBuilder = (db: DataSource, requester: string) => {
  return db
    .createQueryBuilder()
    .select([
      'post.uri AS uri',
      'post.replyParent AS parent',
      'author.did AS authorDid',
      'author.username AS authorName',
      'author_profile.displayName AS authorDisplayName',
      'record.raw AS rawRecord',
      'reply_count.count AS replyCount',
      'like_count.count AS likeCount',
      'repost_count.count AS repostCount',
      'record.indexedAt AS indexedAt',
      'requester_repost.uri AS requesterRepost',
      'requester_like.uri AS requesterLike',
    ])
    .from(PostIndex, 'post')
    .innerJoin(AdxRecord, 'record', 'record.uri = post.uri')
    .innerJoin(UserDid, 'author', 'author.did = post.creator')
    .leftJoin(
      ProfileIndex,
      'author_profile',
      'author.did = author_profile.creator',
    )
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
      RepostIndex,
      'requester_like',
      `requester_like.creator = :requester AND requester_like.subject = post.uri`,
      { requester },
    )
}

// converts the raw SQL output to a Post object
// unfortunately not type-checked since we're dealing with raw SQL, so change with caution!
const rowToPost = (
  row: any,
  parent?: PostThreadView.Post,
): PostThreadView.Post => {
  return {
    uri: row.uri,
    author: {
      did: row.authorDid,
      name: row.authorName,
      displayName: row.authorDisplayName || undefined,
    },
    record: JSON.parse(row.rawRecord),
    parent: parent ? { ...parent } : undefined,
    replyCount: row.replyCount || 0,
    likeCount: row.likeCount || 0,
    repostCount: row.repostCount || 0,
    indexedAt: row.indexedAt,
    myState: {
      repost: row.requesterRepost || undefined,
      like: row.requesterLike || undefined,
    },
  }
}

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
