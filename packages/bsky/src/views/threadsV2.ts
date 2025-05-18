import { AppBskyUnspeccedDefs, asPredicate } from '@atproto/api'
import { PostView } from '../lexicon/types/app/bsky/feed/defs'
import { validateRecord as validatePostRecord } from '../lexicon/types/app/bsky/feed/post'
import {
  ThreadItemBlocked,
  ThreadItemNoUnauthenticated,
  ThreadItemNotFound,
  ThreadItemPost,
} from '../lexicon/types/app/bsky/unspecced/defs'
import { QueryParams as GetPostThreadV2QueryParams } from '../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { $Typed } from '../lexicon/util'

type ThreadLeaf = {
  $type: 'threadLeaf'
  uri: string
  post: $Typed<PostView>
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
  depth: number
  isOPThread: boolean
  hasOPLike: boolean
  hasUnhydratedReplies: boolean
  hasUnhydratedParents: boolean
}

export type ThreadTree =
  | ThreadLeaf
  | $Typed<ThreadItemNoUnauthenticated>
  | $Typed<ThreadItemNotFound>
  | $Typed<ThreadItemBlocked>

export function sortTrimFlattenThreadTree(
  anchorTree: ThreadTree,
  options: SortTrimFlattenOptions,
) {
  const sortedAnchorTree = sortTrimThreadTree(anchorTree, options)
  return flattenThread(sortedAnchorTree, options)
}

type SortTrimFlattenOptions = {
  nestedBranchingFactor: GetPostThreadV2QueryParams['nestedBranchingFactor']
  fetchedAt: number
  opDid: string
  prioritizeFollowedUsers: boolean
  sorting: GetPostThreadV2QueryParams['sorting']
  viewerDid?: string
}

const isPostRecord = asPredicate(validatePostRecord)

function sortTrimThreadTree(
  node: ThreadTree,
  {
    nestedBranchingFactor,
    fetchedAt,
    opDid,
    prioritizeFollowedUsers,
    sorting,
    viewerDid,
  }: SortTrimFlattenOptions,
): ThreadTree {
  if (node.$type !== 'threadLeaf') return node

  if (node.replies) {
    node.replies.sort((a: ThreadTree, b: ThreadTree) => {
      if (a.$type !== 'threadLeaf') {
        return 1
      }
      if (b.$type !== 'threadLeaf') {
        return -1
      }

      // Prioritization is applied first, then the selected sorting is applied.

      // OP replies ⬆️.
      const aIsByOp = a.post.author.did === opDid
      const bIsByOp = b.post.author.did === opDid
      if (aIsByOp && bIsByOp) {
        return a.post.indexedAt.localeCompare(b.post.indexedAt) // oldest
      } else if (aIsByOp) {
        return -1 // op's own reply
      } else if (bIsByOp) {
        return 1 // op's own reply
      }

      // Viewer replies ⬆️.
      const aIsBySelf = a.post.author.did === viewerDid
      const bIsBySelf = b.post.author.did === viewerDid
      if (aIsBySelf && bIsBySelf) {
        return a.post.indexedAt.localeCompare(b.post.indexedAt) // oldest
      } else if (aIsBySelf) {
        return -1 // current account's reply
      } else if (bIsBySelf) {
        return 1 // current account's reply
      }

      // Pushpin-only posts ⬇️.
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

      // Followers posts ⬆️.
      if (prioritizeFollowedUsers) {
        const af = a.post.author.viewer?.following
        const bf = b.post.author.viewer?.following
        if (af && !bf) {
          return -1
        } else if (!af && bf) {
          return 1
        }
      }

      if (sorting === 'app.bsky.unspecced.getPostThreadV2#hotness') {
        const aHotness = getPostHotness(a, fetchedAt)
        const bHotness = getPostHotness(b, fetchedAt)
        return bHotness - aHotness
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#oldest') {
        return a.post.indexedAt.localeCompare(b.post.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#newest') {
        return b.post.indexedAt.localeCompare(a.post.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#mostLikes') {
        if (a.post.likeCount === b.post.likeCount) {
          return b.post.indexedAt.localeCompare(a.post.indexedAt) // newest
        }
        return (b.post.likeCount || 0) - (a.post.likeCount || 0) // most likes
      }
      return b.post.indexedAt.localeCompare(a.post.indexedAt)
    })

    // Applies branching factor to all levels of replies but the direct replies to the anchor.
    if (node.depth !== 0 && nestedBranchingFactor > 0) {
      node.replies = node.replies.slice(0, nestedBranchingFactor)
    }

    node.replies.forEach((reply) =>
      sortTrimThreadTree(reply, {
        nestedBranchingFactor,
        fetchedAt,
        opDid,
        prioritizeFollowedUsers,
        sorting,
        viewerDid,
      }),
    )
  }
  return node
}

function flattenThread(
  anchorTree: ThreadTree,
  options: SortTrimFlattenOptions,
) {
  const isAuthenticated = Boolean(options.viewerDid)

  return Array.from([
    ...Array.from(
      'parent' in anchorTree && anchorTree.parent
        ? flattenInDirection({
            thread: anchorTree.parent,
            isAuthenticated,
            direction: 'up',
          })
        : [],
    ),
    ...Array.from(
      flattenInDirection({
        thread: anchorTree,
        isAuthenticated,
        direction: 'down',
      }),
    ),
  ])
}

function* flattenInDirection({
  thread,
  isAuthenticated,
  direction,
}: {
  thread: ThreadTree
  isAuthenticated: boolean
  direction: 'up' | 'down'
}): Generator<
  | $Typed<ThreadItemPost>
  | $Typed<ThreadItemNoUnauthenticated>
  | $Typed<ThreadItemNotFound>
  | $Typed<ThreadItemBlocked>,
  void
> {
  if (thread.$type === 'threadLeaf') {
    if (direction === 'up') {
      if (thread.parent) {
        yield* flattenInDirection({
          thread: thread.parent,
          isAuthenticated,
          direction: 'up',
        })
      }

      yield threadLeafToItemPost(thread)
    } else {
      // TODO could do this in views probably
      const isNoUnauthenticated = !!thread.post.author.labels?.find(
        (l) => l.val === '!no-unauthenticated',
      )
      if (!isAuthenticated && isNoUnauthenticated) {
        // TODO we exit early atm
        // return HiddenReplyType.None
        yield {
          $type: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated',
          uri: thread.uri,
          depth: thread.depth,
        }
      }

      yield threadLeafToItemPost(thread)

      if (thread.replies?.length) {
        for (const reply of thread.replies) {
          yield* flattenInDirection({
            thread: reply,
            isAuthenticated,
            direction: 'down',
          })
        }
      }
    }
  } else if (AppBskyUnspeccedDefs.isThreadItemNotFound(thread)) {
    yield thread
  } else if (AppBskyUnspeccedDefs.isThreadItemBlocked(thread)) {
    yield thread
  }
}

function threadLeafToItemPost(leaf: ThreadLeaf): $Typed<ThreadItemPost> {
  return {
    $type: 'app.bsky.unspecced.defs#threadItemPost',
    uri: leaf.uri,
    post: leaf.post,
    depth: leaf.depth,
    isOPThread: leaf.isOPThread,
    hasOPLike: leaf.hasOPLike,
    hasUnhydratedReplies: leaf.hasUnhydratedReplies,
    hasUnhydratedParents: leaf.hasUnhydratedParents,
  }
}

// Exported for testing.
// Inspired by https://join-lemmy.org/docs/contributors/07-ranking-algo.html
// We want to give recent comments a real chance (and not bury them deep below the fold)
// while also surfacing well-liked comments from the past.
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
