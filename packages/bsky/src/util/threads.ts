import {
  AppBskyFeedDefs,
  BskyThreadViewPreference,
  asPredicate,
} from '@atproto/api'
import {
  PostView,
  ThreadItemBlocked,
  ThreadItemNoUnauthenticated,
  ThreadItemNotFound,
  ThreadItemPost,
} from '../lexicon/types/app/bsky/feed/defs'
import { QueryParams as GetPostThreadV2QueryParams } from '../lexicon/types/app/bsky/feed/getPostThreadV2'
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

export function sortThreadTree({
  opDid,
  node,
  options,
  viewerDid,
  fetchedAt,
}: {
  opDid: string
  node: ThreadTree
  options: Omit<BskyThreadViewPreference, 'sort'> & {
    sorting: GetPostThreadV2QueryParams['sorting']
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
      if (options.prioritizeFollowedUsers) {
        const af = a.post.author.viewer?.following
        const bf = b.post.author.viewer?.following
        if (af && !bf) {
          return -1
        } else if (!af && bf) {
          return 1
        }
      }

      if (options.sorting === 'app.bsky.feed.getPostThreadV2#hotness') {
        // TODO: cache hotness?
        const aHotness = getPostHotness(a, fetchedAt)
        const bHotness = getPostHotness(b, fetchedAt)
        return bHotness - aHotness
      } else if (options.sorting === 'app.bsky.feed.getPostThreadV2#oldest') {
        return a.post.indexedAt.localeCompare(b.post.indexedAt)
      } else if (options.sorting === 'app.bsky.feed.getPostThreadV2#newest') {
        return b.post.indexedAt.localeCompare(a.post.indexedAt)
      } else if (
        options.sorting === 'app.bsky.feed.getPostThreadV2#mostLikes'
      ) {
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
        opDid,
        node: reply,
        options,
        viewerDid,
        fetchedAt,
      }),
    )
  }
  return node
}

export function flattenThread(anchorTree: ThreadTree) {
  return Array.from([
    ...Array.from(
      // @ts-ignore
      anchorTree.parent
        ? flattenThreadTree({
            // @ts-ignore
            thread: anchorTree.parent,
            isAuthenticated: false,
            direction: 'up',
          })
        : [],
    ),
    ...Array.from(
      flattenThreadTree({ thread: anchorTree, isAuthenticated: false }),
    ),
  ])
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

function* flattenThreadTree({
  thread,
  isAuthenticated,
  direction,
}: {
  thread: ThreadTree
  isAuthenticated: boolean
  direction?: 'up' | 'down'
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
        yield* flattenThreadTree({
          thread: thread.parent,
          isAuthenticated,
          direction: 'up',
        })
      }

      yield threadLeafToSlice(thread)
    } else {
      // TODO could do this in views probably
      const isNoUnauthenticated = !!thread.post.author.labels?.find(
        (l) => l.val === '!no-unauthenticated',
      )
      if (!isAuthenticated && isNoUnauthenticated) {
        // TODO we exit early atm
        // return HiddenReplyType.None
        yield {
          $type: 'app.bsky.feed.defs#threadItemNoUnauthenticated',
          uri: thread.uri,
          depth: thread.depth,
        }
      }

      yield threadLeafToSlice(thread)

      if (thread.replies?.length) {
        for (const reply of thread.replies) {
          yield* flattenThreadTree({
            thread: reply,
            isAuthenticated,
            direction: 'down',
          })

          // TODO what
          // if (thread.depth !== 0) {
          //   break
          // }
          // commented:
          // treeview? works
          // linear? does not work

          // uncommented:
          // treeview? does not work
          // linear? works
        }
      }
    }
  } else if (AppBskyFeedDefs.isThreadItemNotFound(thread)) {
    yield thread
  } else if (AppBskyFeedDefs.isThreadItemBlocked(thread)) {
    yield thread
  }
}

export function threadLeafToSlice(leaf: ThreadLeaf): $Typed<ThreadItemPost> {
  return {
    $type: 'app.bsky.feed.defs#threadItemPost',
    uri: leaf.uri,
    post: leaf.post,
    depth: leaf.depth,
    isOPThread: leaf.isOPThread,
    hasOPLike: leaf.hasOPLike,
    hasUnhydratedReplies: leaf.hasUnhydratedReplies,
    hasUnhydratedParents: leaf.hasUnhydratedParents,
  }
}
