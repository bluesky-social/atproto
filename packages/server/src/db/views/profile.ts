import { isLikedByParams, isProfileParams, LikedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { LikeIndex } from '../records/like'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'

export const profile =
  (db: DataSource) =>
  async (params: unknown): Promise<LikedByView.Response> => {
    if (!isProfileParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:ProfileView')
    }
    const { user } = params

    const builder = db
      .createQueryBuilder()
      .select([
        'user.did',
        'user.username',
        'profile.displayName',
        'profile.description',
        'record.indexedAt',
        'like.createdAt',
      ])
      .from(UserDid, 'user')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .leftJoin(AdxRecord, 'record', 'like.uri = record.uri')
      .leftJoin(UserDid, 'user', 'record.did = user.did')
      .where('like.subject = :uri', { uri })
      .orderBy('like.createdAt')

    if (before !== undefined) {
      builder.andWhere('like.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }
    const res = await builder.getRawMany()

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

export default profile
