import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { keyBy } from '@atproto/common'
import * as ui8 from 'uint8arrays'
import { Database } from '../../../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPosts(req) {
    if (req.uris.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('record')
      .selectAll()
      .where('uri', 'in', req.uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const records = req.uris.map((uri) => {
      const row = byUri[uri]
      const json = row ? row.json : JSON.stringify(null)
      return ui8.fromString(json, 'utf8')
    })
    return { records }
  },
  async getPostReplyCount(req) {
    if (req.uris.length === 0) {
      return { counts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .select(['uri', 'replyCount'])
      .where('uri', 'in', req.uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const counts = req.uris.map((uri) => byUri[uri]?.replyCount ?? 0)
    return { counts }
  },
})
