import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPosts(req) {
    const { uris } = req
    if (uris.length === 0) {
      return { posts: [] }
    }
    const rows = await db.db
      .selectFrom('post')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const byUri = new Map(rows.map((row) => [row.uri, row]))
    return {
      posts: uris.map((uri) => {
        const row = byUri.get(uri)
        if (!row) {
          return { exists: false }
        }
        return {
          exists: true,
          uri: row.uri,
          cid: row.cid,
          creator: row.creator,
          caption: row.caption ?? undefined,
          mediaType: row.mediaType ?? undefined,
          mediaJson:
            row.mediaJson != null ? JSON.stringify(row.mediaJson) : undefined,
          likeCount: row.likeCount,
          createdAt: row.createdAt,
          indexedAt: row.indexedAt,
        }
      }),
    }
  },
})
