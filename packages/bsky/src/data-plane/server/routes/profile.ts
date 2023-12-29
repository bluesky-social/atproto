import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { keyBy } from '@atproto/common'
import { getRecords } from './records'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActors(req) {
    try {
      const { dids } = req
      if (dids.length === 0) {
        return { actors: [] }
      }
      const profileUris = dids.map(
        (did) => `at://${did}/app.bsky.actor.profile/self`,
      )
      const [handlesRes, profiles] = await Promise.all([
        db.db
          .selectFrom('actor')
          .where('did', 'in', dids)
          .selectAll()
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
          takenDown: !!row?.takedownId,
        }
      })
      return { actors }
    } catch (err) {
      console.log(err)
      throw err
    }
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
