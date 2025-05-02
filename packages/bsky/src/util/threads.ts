import {
  AppBskyFeedDefs,
  BskyThreadViewPreference,
  asPredicate,
} from '@atproto/api'
import {
  PostView,
  ThreadSlice,
  ThreadSliceBlocked,
  ThreadSliceNoUnauthenticated,
  ThreadSliceNotFound,
} from '../lexicon/types/app/bsky/feed/defs'
import { validateRecord as validatePostRecord } from '../lexicon/types/app/bsky/feed/post'
import { $Typed } from '../lexicon/util'

const isPostRecord = asPredicate(validatePostRecord)

export type ThreadLeaf = {
  $type: 'threadLeaf'
  uri: string
  post: $Typed<PostView>
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
  depth: number
  isHighlighted: boolean
  isOPThread: boolean
  hasOPLike: boolean
  hasUnhydratedReplies: boolean
  hasUnhydratedParents: boolean
}
export type ThreadTree =
  | ThreadLeaf
  | $Typed<ThreadSliceNoUnauthenticated>
  | $Typed<ThreadSliceNotFound>
  | $Typed<ThreadSliceBlocked>

export function annotateThreadTree(tree: ThreadTree) {
  if (tree.$type !== 'threadLeaf') return

  const opDid = tree.post.author.did
  const parentsByOP: ThreadLeaf[] = [tree]

  /*
   * Walk up parents
   */
  let parent: ThreadTree | undefined = tree.parent
  while (parent) {
    if (parent.$type !== 'threadLeaf' || parent.post.author.did !== opDid) {
      // not a self-tree
      return
    }
    parentsByOP.unshift(parent)
    parent = parent.parent
  }

  if (parentsByOP.length > 1) {
    for (const node of parentsByOP) {
      node.isOPThread = true
    }
  }

  function walkReplies(node: ThreadTree) {
    if (node.$type !== 'threadLeaf') return

    if (node.replies?.length) {
      for (const reply of node.replies) {
        if (reply.$type === 'threadLeaf' && reply.post.author.did === opDid) {
          reply.isOPThread = true
          // TODO has unhydrated replies
          walkReplies(reply)
        }
      }
    }
  }

  walkReplies(tree)
}

export function sortThreadTree({
  node,
  options,
  viewerDid,
  fetchedAt,
}: {
  node: ThreadTree
  options: Omit<BskyThreadViewPreference, 'sort'> & {
    sort: 'hotness' | 'oldest' | 'newest' | 'most-likes' | string
  }
  viewerDid?: string
  fetchedAt: number
}): ThreadTree {
  if (node.$type !== 'threadLeaf') return node

  if (node.replies) {
    node.replies.sort((a: ThreadTree, b: ThreadTree) => {
      if (a.$type !== 'threadLeaf') {
        return 1
      }
      if (b.$type !== 'threadLeaf') {
        return -1
      }

      const aIsByOp = a.post.author.did === node.post?.author.did
      const bIsByOp = b.post.author.did === node.post?.author.did
      if (aIsByOp && bIsByOp) {
        return a.post.indexedAt.localeCompare(b.post.indexedAt) // oldest
      } else if (aIsByOp) {
        return -1 // op's own reply
      } else if (bIsByOp) {
        return 1 // op's own reply
      }

      const aIsBySelf = a.post.author.did === viewerDid
      const bIsBySelf = b.post.author.did === viewerDid
      if (aIsBySelf && bIsBySelf) {
        return a.post.indexedAt.localeCompare(b.post.indexedAt) // oldest
      } else if (aIsBySelf) {
        return -1 // current account's reply
      } else if (bIsBySelf) {
        return 1 // current account's reply
      }

      if (isPostRecord(a.post.record) && isPostRecord(b.post.record)) {
        const aPin = Boolean(a.post.record.text.trim() === '📌')
        const bPin = Boolean(b.post.record.text.trim() === '📌')
        if (aPin !== bPin) {
          if (aPin) {
            return 1
          }
          if (bPin) {
            return -1
          }
        }
      }

      if (options.prioritizeFollowedUsers) {
        const af = a.post.author.viewer?.following
        const bf = b.post.author.viewer?.following
        if (af && !bf) {
          return -1
        } else if (!af && bf) {
          return 1
        }
      }

      // Split items from different fetches into separate generations.
      if (options.sort === 'hotness') {
        const aHotness = getPostHotness(a, fetchedAt)
        const bHotness = getPostHotness(b, fetchedAt)
        return bHotness - aHotness
      } else if (options.sort === 'oldest') {
        return a.post.indexedAt.localeCompare(b.post.indexedAt)
      } else if (options.sort === 'newest') {
        return b.post.indexedAt.localeCompare(a.post.indexedAt)
      } else if (options.sort === 'most-likes') {
        if (a.post.likeCount === b.post.likeCount) {
          return b.post.indexedAt.localeCompare(a.post.indexedAt) // newest
        } else {
          return (b.post.likeCount || 0) - (a.post.likeCount || 0) // most likes
        }
      } else {
        return b.post.indexedAt.localeCompare(a.post.indexedAt)
      }
    })
    node.replies.forEach((reply) =>
      sortThreadTree({
        node: reply,
        options,
        viewerDid,
        fetchedAt,
      }),
    )
  }
  return node
}

// Inspired by https://join-lemmy.org/docs/contributors/07-ranking-algo.html
// We want to give recent comments a real chance (and not bury them deep below the fold)
// while also surfacing well-liked comments from the past. In the future, we can explore
// something more sophisticated, but we don't have much data on the client right now.
export function getPostHotness(thread: ThreadTree, fetchedAt: number) {
  if (thread.$type !== 'threadLeaf') return 0

  const { post, hasOPLike } = thread
  const hoursAgo = Math.max(
    0,
    (new Date(fetchedAt).getTime() - new Date(post.indexedAt).getTime()) /
      (1000 * 60 * 60),
  )
  const likeCount = post.likeCount ?? 0
  const likeOrder = Math.log(3 + likeCount) * (hasOPLike ? 1.45 : 1.0)
  const timePenaltyExponent = 1.5 + 1.5 / (1 + Math.log(1 + likeCount))
  const opLikeBoost = hasOPLike ? 0.8 : 1.0
  const timePenalty = Math.pow(hoursAgo + 2, timePenaltyExponent * opLikeBoost)

  return likeOrder / timePenalty
}

export function* flattenThreadTree({
  thread,
  isAuthenticated,
  direction,
}: {
  thread: ThreadTree
  isAuthenticated: boolean
  direction?: 'up' | 'down'
}): Generator<
  | $Typed<ThreadSlice>
  | $Typed<ThreadSliceNoUnauthenticated>
  | $Typed<ThreadSliceNotFound>
  | $Typed<ThreadSliceBlocked>,
  void
> {
  if (thread.$type === 'threadLeaf') {
    if (direction === 'up') {
      if (thread.parent) {
        yield* flattenThreadTree({
          thread: thread.parent,
          isAuthenticated,
          direction: 'up',
        })
      }

      if (!thread.isHighlighted) {
        yield threadLeafToSlice(thread)
      }
    } else {
      // TODO could do this in views probably
      const isNoUnauthenticated = !!thread.post.author.labels?.find(
        (l) => l.val === '!no-unauthenticated',
      )
      if (!isAuthenticated && isNoUnauthenticated) {
        // TODO we exit early atm
        // return HiddenReplyType.None
        yield {
          $type: 'app.bsky.feed.defs#threadSliceNoUnauthenticated',
          uri: thread.uri,
        }
      }

      if (!thread.isHighlighted) {
        yield threadLeafToSlice(thread)
      }

      if (thread.replies?.length) {
        for (const reply of thread.replies) {
          yield* flattenThreadTree({
            thread: reply,
            isAuthenticated,
            direction: 'down',
          })
          // TODO what
          if (!thread.isHighlighted) {
            break
          }
        }
      }
    }
  } else if (AppBskyFeedDefs.isThreadSliceNotFound(thread)) {
    yield thread
  } else if (AppBskyFeedDefs.isThreadSliceBlocked(thread)) {
    yield thread
  }
}

export function threadLeafToSlice(leaf: ThreadLeaf): $Typed<ThreadSlice> {
  return {
    $type: 'app.bsky.feed.defs#threadSlice',
    uri: leaf.uri,
    post: leaf.post,
    depth: leaf.depth,
    isHighlighted: leaf.isHighlighted,
    isOPThread: leaf.isOPThread,
    hasOPLike: leaf.hasOPLike,
    hasUnhydratedReplies: leaf.hasUnhydratedReplies,
    hasUnhydratedParents: leaf.hasUnhydratedParents,
  }
}
