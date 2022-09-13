import { UserFollowersView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import * as util from './util'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'

const viewId = 'blueskyweb.xyz:UserFollowersView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is UserFollowersView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown): Promise<UserFollowersView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }
    const { user, limit, before } = params

    const subject = await util.getUserInfo(db, user)

    const followersReq = db
      .createQueryBuilder()
      .select([
        'creator.did AS did',
        'creator.username AS name',
        'profile.displayName AS displayName',
        'follow.createdAt AS createdAt',
        'record.indexedAt AS indexedAt',
      ])
      .from(FollowIndex, 'follow')
      .innerJoin(AdxRecord, 'record', 'record.uri = follow.uri')
      .innerJoin(UserDid, 'creator', 'creator.did = record.did')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = record.did')
      .where('follow.subject = :subject', { subject: subject.did })
      .orderBy('follow.createdAt')

    if (before !== undefined) {
      followersReq.andWhere('follow.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      followersReq.limit(limit)
    }

    const followersRes = await followersReq.getRawMany()
    const followers = followersRes.map((row) => ({
      did: row.did,
      name: row.name,
      displayName: row.displayName || undefined,
      createdAt: row.createdAt,
      indexedAt: row.indexedAt,
    }))

    return {
      subject,
      followers,
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
