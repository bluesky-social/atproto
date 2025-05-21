import { AppBskyUnspeccedGetPostThreadV2, asPredicate } from '@atproto/api'
import { HydrateCtx } from '../hydration/hydrator'
import { validateRecord as validatePostRecord } from '../lexicon/types/app/bsky/feed/post'
import {
  QueryParams as GetPostThreadV2QueryParams,
  ThreadItem,
  ThreadItemBlocked,
  ThreadItemNoUnauthenticated,
  ThreadItemNotFound,
  ThreadItemPost,
} from '../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { $Typed } from '../lexicon/util'

type ThreadItemValue<T extends ThreadItem['value']> = Omit<
  ThreadItem,
  'value'
> & {
  value: T
}

export type ThreadItemValueBlocked = ThreadItemValue<$Typed<ThreadItemBlocked>>

export type ThreadItemValueNoUnauthenticated = ThreadItemValue<
  $Typed<ThreadItemNoUnauthenticated>
>

export type ThreadItemValueNotFound = ThreadItemValue<
  $Typed<ThreadItemNotFound>
>

export type ThreadItemValuePost = ThreadItemValue<$Typed<ThreadItemPost>>

type ThreadBlockedNode = {
  item: ThreadItemValueBlocked
}
type ThreadNoUnauthenticatedNode = {
  parent: ThreadTree | undefined
  item: ThreadItemValueNoUnauthenticated
}

type ThreadNotFoundNode = {
  item: ThreadItemValueNotFound
}

type ThreadPostNode = {
  item: ThreadItemValuePost
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
}

const isThreadNoUnauthenticatedNode = (
  node: ThreadTree,
): node is ThreadNoUnauthenticatedNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadItemNoUnauthenticated(node.item.value)

const isThreadPostNode = (node: ThreadTree): node is ThreadPostNode =>
  AppBskyUnspeccedGetPostThreadV2.isThreadItemPost(node.item.value)

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
      const aPost = a.item.value.post
      const bPost = b.item.value.post

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

      // Muted posts ⬇️.
      if (isPostRecord(aPost.record) && isPostRecord(bPost.record)) {
        const aMuted = a.item.value.isMuted
        const bMuted = b.item.value.isMuted
        if (aMuted !== bMuted) {
          if (aMuted) {
            return 1
          }
          if (bMuted) {
            return -1
          }
        }
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
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#oldest') {
        return aPost.indexedAt.localeCompare(bPost.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#newest') {
        return bPost.indexedAt.localeCompare(aPost.indexedAt)
      }
      if (sorting === 'app.bsky.unspecced.getPostThreadV2#top') {
        // Currently it is just a comparison of likes.
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
