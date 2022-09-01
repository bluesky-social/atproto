import { isLikedByParams, LikedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { LikeIndex } from '../records/like'
import { PostIndex } from '../records/post'
import { UserDid } from '../user-dids'

export const likedBy =
  (db: DataSource) =>
  async (params: unknown): Promise<LikedByView.Response> => {
    if (!isLikedByParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:LikedByView')
    }
    const { uri } = params

    const res = await db
      .createQueryBuilder()
      .select([
        'user.did',
        'user.username',
        'user.displayName',
        'record.indexedAt',
        'like.createdAt',
      ])
      .from(PostIndex, 'post')
      .where('post.uri = :uri', { uri })
      .leftJoin(LikeIndex, 'like', 'like.subject = post.uri')
      .leftJoin(AdxRecord, 'record', 'like.uri = record.uri')
      .leftJoin(UserDid, 'user', 'record.did = user.did')
      .getRawMany()

    const likedBy = res.map((row) => ({
      did: row.user_did,
      name: row.user_username,
      displayName: row.user_displayName,
      createdAt: row.like_createdAt,
      indexedAt: row.record_indexedAt,
    }))

    return {
      uri,
      likedBy,
    }
  }

export default likedBy
