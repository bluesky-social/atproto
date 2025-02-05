import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPostReplyCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { counts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .select(['uri', 'replyCount'])
      .where('uri', 'in', uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const counts = uris.map((uri) => byUri.get(uri)?.replyCount ?? 0)
    return { counts }
  },
})
