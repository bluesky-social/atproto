import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { cborEncode, jsonToIpld, keyBy } from '@atproto/common'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPosts(req) {
    if (req.uris.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('record')
      .select('json')
      .where('uri', 'in', req.uris)
      .execute()
    const byUri = keyBy(res, 'uri')

    // @TODO fix this so that it accepts undefined records
    // @ts-ignore
    const records: Uint8Array[] = req.uris.map((uri) => {
      const row = byUri[uri]
      if (!row) {
        return undefined
      }
      return cborEncode(jsonToIpld(JSON.parse(row.json)))
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
