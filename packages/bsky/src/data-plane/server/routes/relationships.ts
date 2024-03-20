import { sql } from 'kysely'
import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { valuesList } from '../db/util'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getRelationships(req) {
    const { actorDid, targetDids } = req
    if (targetDids.length === 0) {
      return { relationships: [] }
    }
    const { ref } = db.db.dynamic
    const res = await db.db
      .selectFrom('actor')
      .where('did', 'in', targetDids)
      .select([
        'actor.did',
        db.db
          .selectFrom('mute')
          .where('mute.mutedByDid', '=', actorDid)
          .whereRef('mute.subjectDid', '=', ref('actor.did'))
          .select(sql<true>`${true}`.as('val'))
          .as('muted'),
        db.db
          .selectFrom('list_item')
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .where('list_mute.mutedByDid', '=', actorDid)
          .whereRef('list_item.subjectDid', '=', ref('actor.did'))
          .select('list_item.listUri')
          .as('mutedByList'),
        db.db
          .selectFrom('actor_block')
          .where('actor_block.creator', '=', actorDid)
          .whereRef('actor_block.subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('blocking'),
        db.db
          .selectFrom('actor_block')
          .where('actor_block.subjectDid', '=', actorDid)
          .whereRef('actor_block.creator', '=', ref('actor.did'))
          .select('uri')
          .as('blockedBy'),
        db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .where('list_block.creator', '=', actorDid)
          .whereRef('list_item.subjectDid', '=', ref('actor.did'))
          .select('list_item.listUri')
          .as('blockingByList'),
        db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .where('list_item.subjectDid', '=', actorDid)
          .whereRef('list_block.creator', '=', ref('actor.did'))
          .select('list_item.listUri')
          .as('blockedByList'),
        db.db
          .selectFrom('follow')
          .where('follow.creator', '=', actorDid)
          .whereRef('follow.subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('following'),
        db.db
          .selectFrom('follow')
          .where('follow.subjectDid', '=', actorDid)
          .whereRef('follow.creator', '=', ref('actor.did'))
          .select('uri')
          .as('followedBy'),
      ])
      .execute()
    const byDid = keyBy(res, 'did')
    const relationships = targetDids.map((did) => {
      const row = byDid[did] ?? {}
      return {
        muted: row.muted ?? false,
        mutedByList: row.mutedByList ?? '',
        blockedBy: row.blockedBy ?? '',
        blocking: row.blocking ?? '',
        blockedByList: row.blockedByList ?? '',
        blockingByList: row.blockingByList ?? '',
        following: row.following ?? '',
        followedBy: row.followedBy ?? '',
      }
    })
    return { relationships }
  },

  async getBlockExistence(req) {
    const { pairs } = req
    if (pairs.length === 0) {
      return { exists: [] }
    }
    const { ref } = db.db.dynamic
    const sourceRef = ref('pair.source')
    const targetRef = ref('pair.target')
    const values = valuesList(pairs.map((p) => sql`${p.a}, ${p.b}`))
    const res = await db.db
      .selectFrom(values.as(sql`pair (source, target)`))
      .select([
        sql<string>`${sourceRef}`.as('source'),
        sql<string>`${targetRef}`.as('target'),
      ])
      .whereExists((qb) =>
        qb
          .selectFrom('actor_block')
          .whereRef('actor_block.creator', '=', sourceRef)
          .whereRef('actor_block.subjectDid', '=', targetRef)
          .select('uri'),
      )
      .orWhereExists((qb) =>
        qb
          .selectFrom('actor_block')
          .whereRef('actor_block.creator', '=', targetRef)
          .whereRef('actor_block.subjectDid', '=', sourceRef)
          .select('uri'),
      )
      .orWhereExists((qb) =>
        qb
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', sourceRef)
          .whereRef('list_item.subjectDid', '=', targetRef)
          .select('list_item.listUri'),
      )
      .orWhereExists((qb) =>
        qb
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', targetRef)
          .whereRef('list_item.subjectDid', '=', sourceRef)
          .select('list_item.listUri'),
      )
      .execute()
    const existMap = res.reduce((acc, cur) => {
      const key = [cur.source, cur.target].sort().join(',')
      return acc.set(key, true)
    }, new Map<string, boolean>())
    const exists = pairs.map((pair) => {
      const key = [pair.a, pair.b].sort().join(',')
      return existMap.get(key) === true
    })
    return {
      exists,
    }
  },
})
