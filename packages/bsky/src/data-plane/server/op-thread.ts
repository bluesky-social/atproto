import { TID } from '@atproto/common'
import { AtUri } from '@atproto/syntax'

export type OpThreadReply = {
  uri: string
  parentUri: string
  deletedAt: string | null
}

// Resolves the oldest contiguous line of OP replies from a thread root.
// A deleted reply keeps its place while replies below it survive. Once
// nothing survives below it, only a reply written after the deletion may
// claim the vacated slot.
export const resolveCanonicalOpThread = (
  rootUri: string,
  opReplies: OpThreadReply[],
): string[] | undefined => {
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

  // Track the current path so malformed denormalized rows cannot introduce a
  // cycle into the result.
  const visited = new Set([rootUri])
  let validOpThread = true
  const resolve = (parentUri: string): string[] => {
    let vacatedAt = 0
    for (const reply of repliesByParent.get(parentUri) ?? []) {
      if (visited.has(reply)) {
        validOpThread = false
        return []
      }

      if (vacatedAt !== 0 && !isOpReplyNewerThanTimestamp(reply, vacatedAt)) {
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

  const opThread = [rootUri, ...resolve(rootUri)]
  // A chain of one is just the root; only threads with OP replies count.
  return validOpThread && opThread.length > 1 ? opThread : undefined
}

// isOpReplyNewerThanTimestamp reports whether the post's rkey places its creation after ts.
// The rkey is a TID, so this is the post's own claimed creation time rather
// than when we observed it. An unparseable rkey is treated as not newer, which
// keeps a malformed reply from claiming a vacated slot.
const isOpReplyNewerThanTimestamp = (uri: string, ts: number): boolean => {
  try {
    const tid = TID.fromStr(new AtUri(uri).rkey)
    // TID timestamps are in microseconds.
    return tid.timestamp() / 1000 > ts
  } catch {
    return false
  }
}
