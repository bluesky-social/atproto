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
  hasOPLike: boolean
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
  opts: SortTrimFlattenOptions,
): ThreadTree {
  if (!isThreadPostNode(node)) {
    return node
  }

  const {
    nestedBranchingFactor,
    fetchedAt,
    opDid,
    prioritizeFollowedUsers,
    sorting,
    viewer,
  } = opts

  if (node.replies) {
    node.replies.sort((aTree: ThreadTree, bTree: ThreadTree) => {
      if (!isThreadPostNode(aTree)) {
        return 1
      }
      if (!isThreadPostNode(bTree)) {
        return -1
      }

      // First applies bumping.
      const bump = applyBumping(aTree, bTree, opts)
      if (bump !== null) {
        return bump
      }

      // Then applies sorting.
      return applySorting(aTree, bTree, opts)
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

function applyBumping(
  aTree: ThreadPostNode,
  bTree: ThreadPostNode,
  opts: SortTrimFlattenOptions,
): number | null {
  const a = aTree.item.value
  const b = bTree.item.value
  const { opDid, prioritizeFollowedUsers, viewer } = opts

  type BumpDirection = 'up' | 'down'
  type BumpPredicateFn = (i: $Typed<ThreadItemPost>) => boolean

  const maybeBump = (
    bump: BumpDirection,
    predicateFn: BumpPredicateFn,
  ): number | null => {
    const aPredicate = predicateFn(a)
    const bPredicate = predicateFn(b)
    if (aPredicate && bPredicate) {
      return applySorting(aTree, bTree, opts)
    } else if (aPredicate) {
      return bump === 'up' ? -1 : 1
    } else if (bPredicate) {
      return bump === 'up' ? 1 : -1
    }
    return null
  }

  // The order of the bumps determines the priority with which they are applied.
  // Bumps-up applied first make the item appear higher in the list than later bumps-up.
  // Bumps-down applied first make the item appear lower in the list than later bumps-down.
  const bumps: [BumpDirection, BumpPredicateFn][] = [
    // OP replies.
    ['up', (i) => i.post.author.did === opDid],
    // Viewer replies.
    ['up', (i) => i.post.author.did === viewer],
    // Muted posts.
    ['down', (i) => i.isMuted],
    // Pushpin-only.
    [
      'down',
      (i) => isPostRecord(i.post.record) && i.post.record.text.trim() === '📌',
    ],
    // Hidden.
    ['down', (i) => i.isHidden],
    // Followers posts.
    ['up', (i) => prioritizeFollowedUsers && !!i.post.author.viewer?.following],
  ]

  for (const [bump, predicateFn] of bumps) {
    const bumpResult = maybeBump(bump, predicateFn)
    if (bumpResult !== null) {
      return bumpResult
    }
  }

  return null
}

function applySorting(
  aTree: ThreadPostNode,
  bTree: ThreadPostNode,
  opts: SortTrimFlattenOptions,
): number {
  const a = aTree.item.value
  const b = bTree.item.value
  const { sorting } = opts

  if (sorting === 'app.bsky.unspecced.getPostThreadV2#oldest') {
    return a.post.indexedAt.localeCompare(b.post.indexedAt)
  }
  if (sorting === 'app.bsky.unspecced.getPostThreadV2#top') {
    const aLikes = a.post.likeCount ?? 0
    const bLikes = b.post.likeCount ?? 0
    const aTop = topSortValue(aLikes, aTree.hasOPLike)
    const bTop = topSortValue(bLikes, bTree.hasOPLike)
    if (aTop !== bTop) {
      return bTop - aTop
    }
  }
  // Fallback to newest.
  return b.post.indexedAt.localeCompare(a.post.indexedAt)
}

function topSortValue(likeCount: number, hasOPLike: boolean): number {
  return Math.log(3 + likeCount) * (hasOPLike ? 1.45 : 1.0)
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
