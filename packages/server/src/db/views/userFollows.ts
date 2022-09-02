import { isUserFollowsParams, UserFollowsView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { UserDid } from '../user-dids'

export const userFollows =
  (db: DataSource) =>
  async (params: unknown): Promise<UserFollowsView.Response> => {
    if (!isUserFollowsParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:UserFollowsView')
    }
    const { user, limit, before } = params

    const subjectReq = db.getRepository(UserDid).findOneBy({ username: user })

    const builder = db
      .createQueryBuilder()
      .select([
        'subject.did',
        'subject.username',
        'subject.displayName',
        'follow.createdAt',
        'record.indexedAt',
      ])
      .from(FollowIndex, 'follow')
      .innerJoin(AdxRecord, 'record', 'follow.uri = record.uri')
      .innerJoin(UserDid, 'creator', 'creator.did = record.did')
      .innerJoin(UserDid, 'subject', 'follow.subject = subject.did')
      .where('creator.username = :user', { user })
      .orderBy('follow.createdAt')

    if (before !== undefined) {
      builder.andWhere('follow.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }

    const [subjectRes, followsRes] = await Promise.all([
      subjectReq,
      builder.getRawMany(),
    ])

    const follows = followsRes.map((row) => ({
      did: row.did,
      name: row.username,
      displayName: row.displayName,
      createdAt: row.follow_createdAt,
      indexedAt: row.record_indexedAt,
    }))

    if (!subjectRes) {
      throw new Error(`Could not find subject: ${user}`)
    }

    return {
      subject: {
        did: subjectRes.did,
        name: subjectRes.username,
        displayName: subjectRes.displayName,
      },
      follows,
    }
  }

export default userFollows
