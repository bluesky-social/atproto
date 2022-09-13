import { LikedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { LikeIndex } from '../records/like'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'

const viewId = 'blueskyweb.xyz:LikedByView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is LikedByView.Params => {
  return validator.isParamsValid(obj)
}

const viewFn =
  (db: DataSource) =>
  async (params: unknown): Promise<LikedByView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }
    const { uri, limit, before } = params

    const builder = db
      .createQueryBuilder()
      .select([
        'user.did AS did',
        'user.username AS name',
        'profile.displayName AS displayName',
        'like.createdAt AS createdAt',
        'record.indexedAt AS indexedAt',
      ])
      .from(LikeIndex, 'like')
      .leftJoin(AdxRecord, 'record', 'like.uri = record.uri')
      .leftJoin(UserDid, 'user', 'like.creator = user.did')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .where('like.subject = :uri', { uri })
      .orderBy('like.createdAt')

    if (before !== undefined) {
      builder.andWhere('like.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }
    const likedByRes = await builder.getRawMany()

    const likedBy = likedByRes.map((row) => ({
      did: row.did,
      name: row.name,
      displayName: row.displayName || undefined,
      createdAt: row.createdAt,
      indexedAt: row.indexedAt,
    }))

    return {
      uri,
      likedBy,
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
