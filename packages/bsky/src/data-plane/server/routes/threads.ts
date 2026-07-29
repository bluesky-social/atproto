import type { ServiceImpl } from '@connectrpc/connect'
import { TID } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import { getAncestorsAndSelfQb, getDescendentsQb } from '../util.js'

// createdAfter reports whether the post's rkey places its creation after ts.
// The rkey is a TID, so this is the post's own claimed creation time rather
// than when we observed it. An unparseable rkey is treated as not newer, which
// keeps a malformed reply from claiming a vacated slot.
const createdAfter = (uri: string, ts: number): boolean => {
  try {
    const tid = TID.fromStr(new AtUri(uri).rkey)
    // TID timestamps are in microseconds.
    return tid.timestamp() / 1000 > ts
  } catch {
    return false
  }
}

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

    const repliesByParent = new Map<string, string[]>()
    const deletedAtByUri = new Map<string, number>()
    for (const reply of opReplies) {
      const siblings = repliesByParent.get(reply.parentUri) ?? []
      siblings.push(reply.uri)
      repliesByParent.set(reply.parentUri, siblings)
      if (reply.deletedAt !== null) {
        deletedAtByUri.set(reply.uri, new Date(reply.deletedAt).getTime())
      }
    }
    // Sort replies (TID enables this) for each parent so we can
    // deterministically pick the oldest reply.
    for (const replies of repliesByParent.values()) {
      replies.sort()
    }

    // Walk the oldest contiguous line of OP replies, mirroring the production
    // dataplane. A deleted reply keeps its place while replies below it
    // survive, so numbering stays stable. Once nothing survives below it the
    // slot is up for grabs, but only a reply the OP wrote after that deletion
    // may claim it: replies that already existed alongside the deleted one
    // were never part of this chain and must not be promoted into it
    // retroactively. The full chain is returned untrimmed by the above/below
    // limits; the appview derives index/count from it.
    //
    // visited tracks the current path, so revisiting a URI means the
    // denormalized rows describe a cycle rather than a tree.
    const visited = new Set([rootUri])
    let validOpThread = true
    const resolve = (parentUri: string): string[] => {
      let vacatedAt = 0
      // sorted already, so siblings are oldest first
      for (const reply of repliesByParent.get(parentUri) ?? []) {
        if (visited.has(reply)) {
          validOpThread = false
          return []
        }

        if (vacatedAt !== 0 && !createdAfter(reply, vacatedAt)) {
          continue
        }

        visited.add(reply)

        const below = resolve(reply)
        if (!validOpThread) {
          return []
        }
        const deletedAt = deletedAtByUri.get(reply)
        if (deletedAt === undefined || below.length > 0) {
          return [reply, ...below]
        }

        visited.delete(reply)
        if (deletedAt > vacatedAt) {
          vacatedAt = deletedAt
        }
      }
      return []
    }
    const opThreadUris = [rootUri, ...resolve(rootUri)]

    return {
      uris,
      // A chain of one is just the root; only threads with OP replies count.
      opThread:
        validOpThread && opThreadUris.length > 1 ? opThreadUris : undefined,
    }
  },
})
