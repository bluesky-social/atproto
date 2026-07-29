import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import { uriToDid } from '../../../util/uris.js'
import type { Database } from '../db/index.js'
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
      .selectFrom('post')
      .select(['uri', 'replyParent'])
      .where('creator', '=', uriToDid(rootUri))
      .where('replyRoot', '=', rootUri)
      .execute()

    const repliesByParent = new Map<string, string[]>()
    for (const reply of opReplies) {
      if (!reply.replyParent) continue
      const siblings = repliesByParent.get(reply.replyParent) ?? []
      siblings.push(reply.uri)
      repliesByParent.set(reply.replyParent, siblings)
    }
    for (const replies of repliesByParent.values()) {
      replies.sort()
    }

    // Walk the oldest contiguous line of OP replies from the root, mirroring
    // the production dataplane. The full chain is returned untrimmed by the
    // above/below limits; the appview derives index/count from it.
    const opThreadUris = [rootUri]
    const visited = new Set(opThreadUris)
    let validOpThread = true
    for (let parentUri = rootUri; ; ) {
      const oldestReply = repliesByParent.get(parentUri)?.[0]
      if (!oldestReply) break
      if (visited.has(oldestReply)) {
        validOpThread = false
        break
      }
      opThreadUris.push(oldestReply)
      visited.add(oldestReply)
      parentUri = oldestReply
    }

    return {
      uris,
      // A chain of one is just the root; only threads with OP replies count.
      opThread:
        validOpThread && opThreadUris.length > 1 ? opThreadUris : undefined,
    }
  },
})
