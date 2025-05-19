import { AppBskyUnspeccedGetPostThreadV2, asPredicate } from '@atproto/api'
import { HydrateCtx } from '../hydration/hydrator'
import { validateRecord as validatePostRecord } from '../lexicon/types/app/bsky/feed/post'
import {
  QueryParams as GetPostThreadV2QueryParams,
  ThreadContentBlocked,
  ThreadContentNoUnauthenticated,
  ThreadContentNotFound,
  ThreadContentPost,
  ThreadItem,
} from '../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { $Typed } from '../lexicon/util'

type ThreadItemContent<T extends ThreadItem['content']> = Omit<
  ThreadItem,
  'content'
> & {
  content: T
}

export type ThreadItemContentBlocked = ThreadItemContent<
  $Typed<ThreadContentBlocked>
>

export type ThreadItemContentNoUnauthenticated = ThreadItemContent<
  $Typed<ThreadContentNoUnauthenticated>
>

export type ThreadItemContentNotFound = ThreadItemContent<
  $Typed<ThreadContentNotFound>
>

export type ThreadItemContentPost = ThreadItemContent<$Typed<ThreadContentPost>>

type ThreadBlockedNode = {
  item: ThreadItemContentBlocked
}
type ThreadNoUnauthenticatedNode = {
  parent: ThreadTree | undefined
  item: ThreadItemContentNoUnauthenticated
}

type ThreadNotFoundNode = {
  item: ThreadItemContentNotFound
}

type ThreadPostNode = {
  item: ThreadItemContentPost
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
}

const isThreadBlockedNode = (node: ThreadTree): node is ThreadBlockedNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadContentBlocked(node.item.content)

const isThreadNotFoundNode = (node: ThreadTree): node is ThreadNotFoundNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadContentNotFound(node.item.content)

const isThreadNoUnauthenticatedNode = (
  node: ThreadTree,
): node is ThreadNoUnauthenticatedNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadContentNoUnauthenticated(
    node.item.content,
  )

const isThreadPostNode = (node: ThreadTree): node is ThreadPostNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadContentPost(node.item.content)

export type ThreadTree =
  | ThreadBlockedNode
  | ThreadNoUnauthenticatedNode
  | ThreadNotFoundNode
  | ThreadPostNode

export function sortTrimFlattenThreadTree(
  anchorTree: ThreadTree,
  options: SortTrimFlattenOptions,
) {
  const sortedAnchorTree = sortTrimThreadTree(anchorTree, options)
  return flattenThread(sortedAnchorTree)
}

type SortTrimFlattenOptions = {
  nestedBranchingFactor: GetPostThreadV2QueryParams['nestedBranchingFactor']
  fetchedAt: number
  opDid: string
  prioritizeFollowedUsers: boolean
  sorting: GetPostThreadV2QueryParams['sorting']
  viewer: HydrateCtx['viewer']
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
    viewer,
  }: SortTrimFlattenOptions,
): ThreadTree {
  if (!isThreadPostNode(node)) {
    return node
  }

  if (node.replies) {
    node.replies.sort((a: ThreadTree, b: ThreadTree) => {
      if (!isThreadPostNode(a)) {
        return 1
      }
      if (!isThreadPostNode(b)) {
        return -1
      }
      const aPost = a.item.content.post
      const bPost = b.item.content.post

      // Prioritization is applied first, then the selected sorting is applied.

      // OP replies ⬆️.
      const aIsByOp = aPost.author.did === opDid
      const bIsByOp = bPost.author.did === opDid
      if (aIsByOp && bIsByOp) {
        return aPost.indexedAt.localeCompare(bPost.indexedAt) // oldest
      } else if (aIsByOp) {
        return -1 // op's own reply
      } else if (bIsByOp) {
        return 1 // op's own reply
      }

      // Viewer replies ⬆️.
      const aIsBySelf = aPost.author.did === viewer
      const bIsBySelf = bPost.author.did === viewer
      if (aIsBySelf && bIsBySelf) {
        return aPost.indexedAt.localeCompare(bPost.indexedAt) // oldest
      } else if (aIsBySelf) {
        return -1 // current account's reply
      } else if (bIsBySelf) {
        return 1 // current account's reply
      }

      // Pushpin-only posts ⬇️.
      if (isPostRecord(aPost.record) && isPostRecord(bPost.record)) {
        const aPin = Boolean(aPost.record.text.trim() === '📌')
        const bPin = Boolean(bPost.record.text.trim() === '📌')
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
        const af = aPost.author.viewer?.following
        const bf = bPost.author.viewer?.following
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
        return aPost.indexedAt.localeCompare(bPost.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#newest') {
        return bPost.indexedAt.localeCompare(aPost.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#mostLikes') {
        if (aPost.likeCount === bPost.likeCount) {
          return bPost.indexedAt.localeCompare(aPost.indexedAt) // newest
        }
        return (bPost.likeCount || 0) - (aPost.likeCount || 0) // most likes
      }
      return bPost.indexedAt.localeCompare(aPost.indexedAt)
    })

    // Trimming: after sorting, apply branching factor to all levels of replies except the anchor direct replies.
    if (node.item.depth !== 0 && nestedBranchingFactor > 0) {
      node.replies = node.replies.slice(0, nestedBranchingFactor)
    }

    node.replies.forEach((reply) =>
      sortTrimThreadTree(reply, {
        nestedBranchingFactor,
        fetchedAt,
        opDid,
        prioritizeFollowedUsers,
        sorting,
        viewer,
      }),
    )
  }
  return node
}

function flattenThread(anchorTree: ThreadTree) {
  return Array.from([
    // All parents above.
    ...Array.from(
      'parent' in anchorTree && anchorTree.parent
        ? flattenInDirection({
            thread: anchorTree.parent,
            direction: 'up',
          })
        : [],
    ),
    // The anchor and all children below.
    ...Array.from(
      flattenInDirection({
        thread: anchorTree,
        direction: 'down',
      }),
    ),
  ])
}

function* flattenInDirection({
  thread,
  direction,
}: {
  thread: ThreadTree
  direction: 'up' | 'down'
}): Generator<ThreadItem, void> {
  // Blocked items don't yield further items up or down.
  if (isThreadBlockedNode(thread)) {
    yield thread.item
    return
  }

  // Not found items don't yield further items up or down.
  if (isThreadNotFoundNode(thread)) {
    yield thread.item
    return
  }

  if (isThreadNoUnauthenticatedNode(thread)) {
    if (direction === 'up') {
      if (thread.parent) {
        // Unfold all parents above.
        yield* flattenInDirection({
          thread: thread.parent,
          direction: 'up',
        })
      }

      // Yield, starting from the top parent.
      yield thread.item
    } else {
      // Yield the no unauthenticated item, but not its children.
      yield thread.item
    }
    return
  }

  if (isThreadPostNode(thread)) {
    if (direction === 'up') {
      if (thread.parent) {
        // Unfold all parents above.
        yield* flattenInDirection({
          thread: thread.parent,
          direction: 'up',
        })
      }

      // Yield, starting from the top parent.
      yield thread.item
    } else {
      // Yield the item itself (either the anchor or a reply).
      yield thread.item

      // Unfold all replies below.
      if (thread.replies?.length) {
        for (const reply of thread.replies) {
          yield* flattenInDirection({
            thread: reply,
            direction: 'down',
          })
        }
      }
    }
  }
}

// Exported for testing.
// Inspired by https://join-lemmy.org/docs/contributors/07-ranking-algo.html
// We want to give recent comments a real chance (and not bury them deep below the fold)
// while also surfacing well-liked comments from the past.
export function getPostHotness(thread: ThreadPostNode, fetchedAt: number) {
  if (!isThreadPostNode(thread)) return 0

  const {
    item: { content },
  } = thread
  const { post, hasOPLike } = content

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
