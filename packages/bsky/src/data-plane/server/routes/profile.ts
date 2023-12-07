import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { keyBy } from '@atproto/common'
import * as ui8 from 'uint8arrays'
import { Database } from '../../../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getProfiles(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { records: [] }
    }
    const uris = dids.map((did) => `at://${did}/app.bsky.actor.profile/self`)
    const res = await db.db
      .selectFrom('record')
      .selectAll()
      .where('uri', 'in', uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const records = uris.map((uri) => {
      const row = byUri[uri]
      const json = row ? row.json : JSON.stringify(null)
      return ui8.fromString(json, 'utf8')
    })
    return { records }
  },

  async getHandles(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { handles: [] }
    }
    const res = await db.db
      .selectFrom('actor')
      .where('did', 'in', dids)
      .selectAll()
      .execute()
    const byDid = keyBy(res, 'did')
    const handles = dids.map((did) => byDid[did]?.handle ?? '')
    return { handles }
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
