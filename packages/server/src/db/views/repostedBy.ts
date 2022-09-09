import { RepostedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'
import { RepostIndex } from '../records/repost'

const viewId = 'blueskyweb.xyz:RepostedByView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is RepostedByView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown): Promise<RepostedByView.Response> => {
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
        'repost.createdAt AS createdAt',
        'record.indexedAt AS indexedAt',
      ])
      .from(RepostIndex, 'repost')
      .leftJoin(AdxRecord, 'record', 'repost.uri = record.uri')
      .leftJoin(UserDid, 'user', 'repost.creator = user.did')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .where('repost.subject = :uri', { uri })
      .orderBy('repost.createdAt')

    if (before !== undefined) {
      builder.andWhere('repost.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }
    const repostedByRes = await builder.getRawMany()

    const repostedBy = repostedByRes.map((row) => ({
      did: row.did,
      name: row.name,
      displayName: row.displayName || undefined,
      createdAt: row.createdAt,
      indexedAt: row.indexedAt,
    }))

    return {
      uri,
      repostedBy,
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
