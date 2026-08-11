import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import { resolveCanonicalOpThread } from '../op-thread.js'
import { getAncestorsAndSelfQb, getDescendentsQb } from '../util.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getThread(req) {
    const { postUri, above, below } = req
    const [anchor, ancestors, descendents] = await Promise.all([
      db.db
        .selectFrom('post')
        .select('replyRoot')
        .where('uri', '=', postUri)
        .executeTakeFirst(),
      getAncestorsAndSelfQb(db.db, {
        uri: postUri,
        parentHeight: above,
      })
        .selectFrom('ancestor')
        .selectAll()
        .execute(),
      getDescendentsQb(db.db, {
        uri: postUri,
        depth: below,
      })
        .selectFrom('descendent')
        .innerJoin('post', 'post.uri', 'descendent.uri')
        .orderBy('post.sortAt', 'desc')
        .selectAll()
        .execute(),
    ])
    const uris = [
      ...ancestors.map((p) => p.uri),
      ...descendents.map((p) => p.uri),
    ]
    const rootUri = anchor?.replyRoot ?? postUri
    const opReplies = await db.db
      .selectFrom('op_thread_reply')
      .select(['uri', 'parentUri', 'deletedAt'])
      .where('rootUri', '=', rootUri)
      .execute()
    const opThread = resolveCanonicalOpThread(rootUri, opReplies)

    return {
      uris,
      opThread,
    }
  },
})
