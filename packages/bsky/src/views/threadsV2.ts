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
  return flattenThree(sortedAnchorTree)
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

      // Applies the selected sorting.
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

function flattenThree(tree: ThreadTree) {
  return Array.from([
    // All parents above.
    ...Array.from(
      flattenInDirection({
        tree,
        direction: 'up',
      }),
    ),

    // The anchor.
    tree.item,

    // All replies below.
    ...Array.from(
      flattenInDirection({
        tree,
        direction: 'down',
      }),
    ),
  ])
}

function* flattenInDirection({
  tree,
  direction,
}: {
  tree: ThreadTree
  direction: 'up' | 'down'
}): Generator<ThreadItem, void> {
  if (isThreadNoUnauthenticatedNode(tree)) {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenThree(tree.parent)
      }
    }
  }

  if (isThreadPostNode(tree)) {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenThree(tree.parent)
      }
    } else {
      // Unfold all replies below.
      if (tree.replies?.length) {
        for (const reply of tree.replies) {
          yield* flattenThree(reply)
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
