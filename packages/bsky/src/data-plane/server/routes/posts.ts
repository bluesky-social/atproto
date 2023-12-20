import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { keyBy } from '@atproto/common'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPostReplyCounts(req) {
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
  async getPostCounts(req) {
    if (req.dids.length === 0) {
      return { counts: [] }
    }
    const res = await db.db
      .selectFrom('profile_agg')
      .selectAll()
      .where('did', 'in', req.dids)
      .execute()
    const byDid = keyBy(res, 'did')
    const counts = req.dids.map((did) => byDid[did]?.postsCount ?? 0)
    return { counts }
  },
})
