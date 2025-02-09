import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import { FollowsFollowing } from '../../../proto/bsky_pb'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

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
    const uris = targetDids.map((did) => bySubject.get(did)?.uri ?? '')
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
        'follow.creator as creatorDid',
        'follow.subjectDid as subjectDid',
        'follow.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
    followersReq = paginate(followersReq, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const followers = await followersReq.execute()
    return {
      followers: followers.map((f) => ({
        uri: f.uri,
        actorDid: f.creatorDid,
        subjectDid: f.subjectDid,
      })),
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
        'follow.creator as creatorDid',
        'follow.subjectDid as subjectDid',
        'follow.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
    followsReq = paginate(followsReq, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const follows = await followsReq.execute()

    return {
      follows: follows.map((f) => ({
        uri: f.uri,
        actorDid: f.creatorDid,
        subjectDid: f.subjectDid,
      })),
      cursor: keyset.packFromResult(follows),
    }
  },

  /**
   * Return known followers of a given actor.
   *
   * Example:
   *   - Alice follows Bob
   *   - Bob follows Dan
   *
   *   If Alice (the viewer) looks at Dan's profile (the subject), she should see that Bob follows Dan
   */
  async getFollowsFollowing(req) {
    const { actorDid: viewerDid, targetDids: subjectDids } = req

    /*
     * 1. Get all the people the Alice is following
     * 2. Get all the people the Dan is followed by
     * 3. Find the intersection
     */

    const results: FollowsFollowing[] = []

    for (const subjectDid of subjectDids) {
      const followsReq = db.db
        .selectFrom('follow')
        .where('follow.creator', '=', viewerDid)
        .where(
          'follow.subjectDid',
          'in',
          db.db
            .selectFrom('follow')
            .where('follow.subjectDid', '=', subjectDid)
            .select(['creator']),
        )
        .select(['subjectDid'])
      const rows = await followsReq.execute()
      results.push(
        new FollowsFollowing({
          targetDid: subjectDid,
          dids: rows.map((r) => r.subjectDid),
        }),
      )
    }

    return { results }
  },
})
