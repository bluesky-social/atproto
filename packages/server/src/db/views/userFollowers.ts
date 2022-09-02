import { isUserFollowersParams, UserFollowersView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'

export const userFollowers =
  (db: DataSource) =>
  async (params: unknown): Promise<UserFollowersView.Response> => {
    if (!isUserFollowersParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:UserFollowersView')
    }
    const { user, limit, before } = params

    const subjectReq = db
      .createQueryBuilder()
      .select(['user.did', 'user.username', 'profile.displayName'])
      .from(UserDid, 'user')
      .innerJoin(ProfileIndex, 'profile', 'profile.creator = user.did')

    const followersReq = db
      .createQueryBuilder()
      .select([
        'creator.did',
        'creator.username',
        'profile.displayName',
        'follow.createdAt',
        'record.indexedAt',
      ])
      .from(FollowIndex, 'follow')
      .innerJoin(AdxRecord, 'record', 'record.uri = follow.uri')
      .innerJoin(UserDid, 'creator', 'creator.did = record.did')
      .innerJoin(ProfileIndex, 'profile', 'profile.creator = record.did')
      .innerJoin(UserDid, 'subject', 'subject.did = follow.subject')
      .where('subject.username = :user', { user })
      .orderBy('follow.createdAt')

    if (before !== undefined) {
      followersReq.andWhere('follow.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      followersReq.limit(limit)
    }

    const [subjectRes, followersRes] = await Promise.all([
      subjectReq.getRawOne(),
      followersReq.getRawMany(),
    ])

    if (!subjectRes) {
      throw new Error(`Could not find subject: ${user}`)
    }

    const followers = followersRes.map((row) => ({
      did: row.creator_did,
      name: row.creator_username,
      displayName: row.profile_displayName,
      createdAt: row.follow_createdAt,
      indexedAt: row.record_indexedAt,
    }))

    return {
      subject: {
        did: subjectRes.user_did,
        name: subjectRes.user_username,
        displayName: subjectRes.profile_displayName,
      },
      followers,
    }
  }

export default userFollowers
