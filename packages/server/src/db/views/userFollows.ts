import { UserFollowsView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import * as util from './util'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'

const viewId = 'blueskyweb.xyz:UserFollowsView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is UserFollowsView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown): Promise<UserFollowsView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }
    const { user, limit, before } = params

    const creator = await util.getUserInfo(db, user)

    const followsReq = db
      .createQueryBuilder()
      .select([
        'subject.did AS did',
        'subject.username AS name',
        'profile.displayName AS displayName',
        'follow.createdAt AS createdAt',
        'record.indexedAt AS indexedAt',
      ])
      .from(FollowIndex, 'follow')
      .innerJoin(AdxRecord, 'record', 'follow.uri = record.uri')
      .innerJoin(UserDid, 'subject', 'follow.subject = subject.did')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = follow.subject')
      .where('follow.creator = :creator', { creator: creator.did })
      .orderBy('follow.createdAt')

    if (before !== undefined) {
      followsReq.andWhere('follow.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      followsReq.limit(limit)
    }

    const follows = await followsReq.getRawMany()

    return {
      subject: creator,
      follows,
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
