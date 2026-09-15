import type { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import type { Service } from '../../../proto/bsky_connect.js'
import {
  FollowsFollowing,
  SampledFollowsFollowing,
} from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'
import { countAll } from '../db/util.js'

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

    const page = keyset.page(await followersReq.execute(), limit)
    return {
      followers: page.items.map((f) => ({
        uri: f.uri,
        actorDid: f.creatorDid,
        subjectDid: f.subjectDid,
      })),
      cursor: page.cursor,
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

    const page = keyset.page(await followsReq.execute(), limit)

    return {
      follows: page.items.map((f) => ({
        uri: f.uri,
        actorDid: f.creatorDid,
        subjectDid: f.subjectDid,
      })),
      cursor: page.cursor,
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
    const { actorDid: viewerDid, targetDids: subjectDids, limit, cursor } = req
    const results = await Promise.all(
      subjectDids.map(async (subjectDid) => {
        const { dids, cursor: nextCursor } = await getKnownFollowers(
          db,
          viewerDid,
          subjectDid,
          limit,
          cursor,
        )
        return new FollowsFollowing({
          targetDid: subjectDid,
          dids,
          cursor: nextCursor,
        })
      }),
    )
    return { results }
  },
  async sampleFollowsFollowing(req) {
    const { actorDid: viewerDid, targetDids: subjectDids, limit } = req
    const results = await Promise.all(
      subjectDids.map(async (subjectDid) => {
        const { dids, total } = await getKnownFollowers(
          db,
          viewerDid,
          subjectDid,
          limit,
        )
        return new SampledFollowsFollowing({
          targetDid: subjectDid,
          dids,
          totalKnown: total,
        })
      }),
    )
    return { results }
  },
})

const getKnownFollowers = async (
  db: Database,
  viewerDid: string,
  subjectDid: string,
  limit?: number,
  cursor?: string,
) => {
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
    .select(['subjectDid', 'sortAt', 'cid'])

  const totalReq = followsReq
    .clearSelect()
    .select(countAll.as('count'))
    .executeTakeFirst()
  let pageReq = followsReq
  let pageLimit: number | undefined
  if (limit && limit > 0) {
    pageLimit = limit
    const { ref } = db.db.dynamic
    const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
    pageReq = paginate(pageReq, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })
  }

  const [rows, totalRow] = await Promise.all([pageReq.execute(), totalReq])
  const keyset = new TimeCidKeyset<{ sortAt: string; cid: string }>(
    db.db.dynamic.ref('follow.sortAt'),
    db.db.dynamic.ref('follow.cid'),
  )
  const page =
    pageLimit === undefined ? { items: rows } : keyset.page(rows, pageLimit)
  return {
    dids: page.items.map((row) => row.subjectDid),
    total: totalRow?.count ?? 0,
    cursor: page.cursor,
  }
}
