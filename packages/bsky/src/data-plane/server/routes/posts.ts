import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { cborEncode, jsonToIpld } from '@atproto/common'

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
    const records = res.map((row) =>
      cborEncode(jsonToIpld(JSON.parse(row.json))),
    )
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
    const countByUri = res.reduce((acc, cur) => {
      acc[cur.uri] = cur.replyCount
      return acc
    }, {} as Record<string, number>)
    const counts = req.uris.map((uri) => countByUri[uri] ?? 0)
    return { counts }
  },
})
