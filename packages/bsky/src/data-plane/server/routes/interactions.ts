import { keyBy } from '@atproto/common'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getInteractionCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { likes: [], replies: [], reposts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const byUri = keyBy(res, 'uri')
    return {
      likes: uris.map((uri) => byUri[uri]?.likeCount ?? 0),
      replies: uris.map((uri) => byUri[uri]?.replyCount ?? 0),
      reposts: uris.map((uri) => byUri[uri]?.repostCount ?? 0),
    }
  },
  async getCountsForUsers(req) {
    if (req.dids.length === 0) {
      return { followers: [], following: [], posts: [] }
    }
    const res = await db.db
      .selectFrom('profile_agg')
      .selectAll()
      .where('did', 'in', req.dids)
      .execute()
    const byDid = keyBy(res, 'did')
    return {
      followers: req.dids.map((uri) => byDid[uri]?.followersCount ?? 0),
      following: req.dids.map((uri) => byDid[uri]?.followsCount ?? 0),
      posts: req.dids.map((uri) => byDid[uri]?.postsCount ?? 0),
    }
  },
})
