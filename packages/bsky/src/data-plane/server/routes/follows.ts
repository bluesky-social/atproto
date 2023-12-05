import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { TimeCidKeyset, paginate } from '../../../db/pagination'
import { keyBy } from '@atproto/common'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorFollowsActors(req) {
    const { actorDid, targetDids } = req
    if (targetDids.length < 1) {
      return { uris: [] }
    }
    const res = await db.db
      .selectFrom('follow')
      .where('follow.creator', '=', actorDid)
      .where('follow.subjectDid', 'in', targetDids)
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subjectDid')
    const uris = targetDids.map((did) => bySubject[did]?.uri ?? '')
    return {
      uris,
    }
  },
  async getFollowers(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic
    let followersReq = db.db
      .selectFrom('follow')
      .where('follow.subjectDid', '=', actorDid)
      .innerJoin('actor as creator', 'creator.did', 'follow.creator')
      .selectAll('creator')
      .select([
        'follow.uri as uri',
        'follow.cid as cid',
        'follow.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
    followersReq = paginate(followersReq, {
      limit,
      cursor,
      keyset,
    })

    const followers = await followersReq.execute()
    return {
      uris: followers.map((f) => f.uri),
      cursor: keyset.packFromResult(followers),
    }
  },
  async getFollows(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic

    let followsReq = db.db
      .selectFrom('follow')
      .where('follow.creator', '=', actorDid)
      .innerJoin('actor as subject', 'subject.did', 'follow.subjectDid')
      .selectAll('subject')
      .select([
        'follow.uri as uri',
        'follow.cid as cid',
        'follow.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
    followsReq = paginate(followsReq, {
      limit,
      cursor,
      keyset,
    })

    const follows = await followsReq.execute()

    return {
      uris: follows.map((f) => f.uri),
      cursor: keyset.packFromResult(follows),
    }
  },
  async getFollowersCount(req) {
    const res = await db.db
      .selectFrom('profile_agg')
      .select('followersCount')
      .where('did', '=', req.actorDid)
      .executeTakeFirst()
    return {
      count: res?.followersCount,
    }
  },
  async getFollowsCount(req) {
    const res = await db.db
      .selectFrom('profile_agg')
      .select('followsCount')
      .where('did', '=', req.actorDid)
      .executeTakeFirst()
    return {
      count: res?.followsCount,
    }
  },
})
