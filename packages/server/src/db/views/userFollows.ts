import { isUserFollowsParams, UserFollowsView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'

export const userFollows =
  (db: DataSource) =>
  async (params: unknown): Promise<UserFollowsView.Response> => {
    if (!isUserFollowsParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:UserFollowsView')
    }
    const { user, limit, before } = params

    const subjectReq = db
      .createQueryBuilder()
      .select(['user.did', 'user.username', 'profile.displayName'])
      .from(UserDid, 'user')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')

    const followsReq = db
      .createQueryBuilder()
      .select([
        'subject.did',
        'subject.username',
        'profile.displayName',
        'follow.createdAt',
        'record.indexedAt',
      ])
      .from(FollowIndex, 'follow')
      .innerJoin(AdxRecord, 'record', 'follow.uri = record.uri')
      .innerJoin(UserDid, 'creator', 'creator.did = record.did')
      .innerJoin(UserDid, 'subject', 'follow.subject = subject.did')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = follow.subject')
      .where('creator.username = :user', { user })
      .orderBy('follow.createdAt')

    if (before !== undefined) {
      followsReq.andWhere('follow.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      followsReq.limit(limit)
    }

    const [subjectRes, followsRes] = await Promise.all([
      subjectReq.getRawOne(),
      followsReq.getRawMany(),
    ])

    const follows = followsRes.map((row) => ({
      did: row.subject_did,
      name: row.subject_username,
      displayName: row.profile_displayName || undefined,
      createdAt: row.follow_createdAt,
      indexedAt: row.record_indexedAt,
    }))

    if (!subjectRes) {
      throw new Error(`Could not find subject: ${user}`)
    }

    return {
      subject: {
        did: subjectRes.user_did,
        name: subjectRes.user_username,
        displayName: subjectRes.profile_displayName || undefined,
      },
      follows,
    }
  }

export default userFollows
