import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { keyBy } from '@atproto/common'
import { getRecords } from './records'
import { Database } from '../db'
import { sql } from 'kysely'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActors(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { actors: [] }
    }
    const profileUris = dids.map(
      (did) => `at://${did}/app.bsky.actor.profile/self`,
    )
    const { ref } = db.db.dynamic
    const [handlesRes, profiles] = await Promise.all([
      db.db
        .selectFrom('actor')
        .where('did', 'in', dids)
        .selectAll('actor')
        .select([
          db.db
            .selectFrom('labeler')
            .whereRef('creator', '=', ref('actor.did'))
            .select(sql<true>`${true}`.as('val'))
            .as('isLabeler'),
        ])
        .execute(),
      getRecords(db)({ uris: profileUris }),
    ])
    const byDid = keyBy(handlesRes, 'did')
    const actors = dids.map((did, i) => {
      const row = byDid[did]
      return {
        exists: !!row,
        handle: row?.handle ?? undefined,
        profile: profiles.records[i],
        takenDown: !!row?.takedownRef,
        takedownRef: row?.takedownRef || undefined,
        tombstonedAt: undefined, // in current implementation, tombstoned actors are deleted
        labeler: row?.isLabeler ?? false,
      }
    })
    return { actors }
  },

  async getDidsByHandles(req) {
    const { handles } = req
    if (handles.length === 0) {
      return { dids: [] }
    }
    const res = await db.db
      .selectFrom('actor')
      .where('handle', 'in', handles)
      .selectAll()
      .execute()
    const byHandle = keyBy(res, 'handle')
    const dids = handles.map((handle) => byHandle[handle]?.did ?? '')
    return { dids }
  },
})
