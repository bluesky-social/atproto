import { HydrateCtx } from '../hydration/hydrator'
import {
  ThreadItemBlocked,
  ThreadItemNoUnauthenticated,
  ThreadItemNotFound,
  ThreadItemPost,
} from '../lexicon/types/app/bsky/unspecced/defs'
import { ThreadItem as ThreadOtherItem } from '../lexicon/types/app/bsky/unspecced/getPostThreadOtherV2'
import {
  QueryParams as GetPostThreadV2QueryParams,
  ThreadItem,
} from '../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { $Typed } from '../lexicon/util'

type ThreadMaybeOtherPostNode = ThreadPostNode | ThreadOtherPostNode
type ThreadNodeWithReplies =
  | ThreadPostNode
  | ThreadOtherPostNode
  | ThreadOtherAnchorPostNode

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
  type: 'blocked'
  item: ThreadItemValueBlocked
}
type ThreadNoUnauthenticatedNode = {
  type: 'noUnauthenticated'
  parent: ThreadTree | undefined
  item: ThreadItemValueNoUnauthenticated
}

type ThreadNotFoundNode = {
  type: 'notFound'
  item: ThreadItemValueNotFound
}

type ThreadPostNode = {
  type: 'post'
  item: ThreadItemValuePost
  tags: Set<string>
  hasOPLike: boolean
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
}

type ThreadOtherItemValue<T extends ThreadOtherItem['value']> = Omit<
  ThreadOtherItem,
  'value'
> & {
  value: T
}

export type ThreadOtherItemValuePost = ThreadOtherItemValue<
  $Typed<ThreadItemPost>
>

// This is an intermediary type that doesn't map to the views.
// It is useful to differentiate between the anchor post and the replies for the hidden case,
// while also differentiating between hidden and visible cases.
export type ThreadOtherAnchorPostNode = {
  type: 'hiddenAnchor'
  item: Omit<ThreadOtherItem, 'value'> & { value: undefined }
  replies: ThreadOtherPostNode[] | undefined
}

export type ThreadOtherPostNode = {
  type: 'hiddenPost'
  item: ThreadOtherItemValuePost
  tags: Set<string>
  replies: ThreadOtherPostNode[] | undefined
}

const isNodeWithReplies = (node: ThreadTree): node is ThreadNodeWithReplies =>
  'replies' in node && node.replies !== undefined

const isPostNode = (node: ThreadTree): node is ThreadMaybeOtherPostNode =>
  node.type === 'post' || node.type === 'hiddenPost'

export type ThreadTreeVisible =
  | ThreadBlockedNode
  | ThreadNoUnauthenticatedNode
  | ThreadNotFoundNode
  | ThreadPostNode

export type ThreadTreeOther = ThreadOtherAnchorPostNode | ThreadOtherPostNode

export type ThreadTree = ThreadTreeVisible | ThreadTreeOther

/** This function mutates the tree parameter. */
export function sortTrimFlattenThreadTree(
  anchorTree: ThreadTree,
  options: SortTrimFlattenOptions,
  useExploration?: boolean,
) {
  const sortedAnchorTree = useExploration
    ? sortTrimThreadTreeExploration(anchorTree, options)
    : sortTrimThreadTree(anchorTree, options)

  return flattenTree(sortedAnchorTree)
}

type SortTrimFlattenOptions = {
  branchingFactor: GetPostThreadV2QueryParams['branchingFactor']
  opDid: string
  sort?: GetPostThreadV2QueryParams['sort']
  viewer: HydrateCtx['viewer']
  threadTagsBumpDown: readonly string[]
  threadTagsHide: readonly string[]
  visibilityTagRankPrefix: string
}

/** This function mutates the tree parameter. */
function sortTrimThreadTree(
  n: ThreadTree,
  opts: SortTrimFlattenOptions,
): ThreadTree {
  if (!isNodeWithReplies(n)) {
    return n
  }
  const node: ThreadNodeWithReplies = n

  if (node.replies) {
    node.replies.sort((an: ThreadTree, bn: ThreadTree) => {
      if (!isPostNode(an)) {
        return 1
      }
      if (!isPostNode(bn)) {
        return -1
      }
      const aNode: ThreadMaybeOtherPostNode = an
      const bNode: ThreadMaybeOtherPostNode = bn

      // First applies bumping.
      const bump = applyBumping(aNode, bNode, opts)
      if (bump !== null) {
        return bump
      }

      // Then applies sorting.
      return applySorting(aNode, bNode, opts)
    })

    // Trimming: after sorting, apply branching factor to all levels of replies except the anchor direct replies.
    if (node.item.depth !== 0) {
      node.replies = node.replies.slice(0, opts.branchingFactor)
    }

    node.replies.forEach((reply) => sortTrimThreadTree(reply, opts))
  }

  return node
}

function applyBumping(
  aNode: ThreadMaybeOtherPostNode,
  bNode: ThreadMaybeOtherPostNode,
  opts: SortTrimFlattenOptions,
): number | null {
  if (!isPostNode(aNode)) {
    return null
  }
  if (!isPostNode(bNode)) {
    return null
  }

  const { opDid, viewer, threadTagsBumpDown, threadTagsHide } = opts

  type BumpDirection = 'up' | 'down'
  type BumpPredicateFn = (i: ThreadMaybeOtherPostNode) => boolean

  const maybeBump = (
    bump: BumpDirection,
    predicateFn: BumpPredicateFn,
  ): number | null => {
    const aPredicate = predicateFn(aNode)
    const bPredicate = predicateFn(bNode)
    if (aPredicate && bPredicate) {
      return applySorting(aNode, bNode, opts)
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
    /*
      General bumps.
    */
    // OP replies.
    ['up', (i) => i.item.value.post.author.did === opDid],
    // Viewer replies.
    ['up', (i) => i.item.value.post.author.did === viewer],

    /*
      Bumps within visible replies.
    */
    // Followers posts.
    [
      'up',
      (i) => i.type === 'post' && !!i.item.value.post.author.viewer?.following,
    ],
    // Bump-down tags.
    [
      'down',
      (i) => i.type === 'post' && threadTagsBumpDown.some((t) => i.tags.has(t)),
    ],

    /*
      Bumps within hidden replies.
      This determines the order of hidden replies:
        1. hidden by threadgate.
        2. hidden by tags.
        3. muted by viewer.
    */
    // Muted account by the viewer.
    ['down', (i) => i.type === 'hiddenPost' && i.item.value.mutedByViewer],
    // Hidden by tags.
    [
      'down',
      (i) =>
        i.type === 'hiddenPost' && threadTagsHide.some((t) => i.tags.has(t)),
    ],
    // Hidden by threadgate.
    ['down', (i) => i.type === 'hiddenPost' && i.item.value.hiddenByThreadgate],
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
  aNode: ThreadMaybeOtherPostNode,
  bNode: ThreadMaybeOtherPostNode,
  opts: SortTrimFlattenOptions,
): number {
  const a = aNode.item.value
  const b = bNode.item.value

  // Only customize sort for visible posts.
  if (aNode.type === 'post' && bNode.type === 'post') {
    const { sort } = opts

    if (sort === 'oldest') {
      return a.post.indexedAt.localeCompare(b.post.indexedAt)
    }
    if (sort === 'top') {
      const aLikes = a.post.likeCount ?? 0
      const bLikes = b.post.likeCount ?? 0
      const aTop = topSortValue(aLikes, aNode.hasOPLike)
      const bTop = topSortValue(bLikes, bNode.hasOPLike)
      if (aTop !== bTop) {
        return bTop - aTop
      }
    }
  }

  // Fallback to newest.
  return b.post.indexedAt.localeCompare(a.post.indexedAt)
}

function topSortValue(likeCount: number, hasOPLike: boolean): number {
  return Math.log(3 + likeCount) * (hasOPLike ? 1.45 : 1.0)
}

function flattenTree(tree: ThreadTree) {
  return [
    // All parents above.
    ...Array.from(
      flattenInDirection({
        tree,
        direction: 'up',
      }),
    ),

    // The anchor.
    // In the case of hidden replies, the anchor item itself is undefined.
    ...(tree.item.value ? [tree.item] : []),

    // All replies below.
    ...Array.from(
      flattenInDirection({
        tree,
        direction: 'down',
      }),
    ),
  ]
}

function* flattenInDirection({
  tree,
  direction,
}: {
  tree: ThreadTree
  direction: 'up' | 'down'
}) {
  if (tree.type === 'noUnauthenticated') {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenTree(tree.parent)
      }
    }
  }

  if (tree.type === 'post') {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenTree(tree.parent)
      }
    } else {
      // Unfold all replies below.
      if (tree.replies?.length) {
        for (const reply of tree.replies) {
          yield* flattenTree(reply)
        }
      }
    }
  }

  // For the first level of hidden replies, the items are undefined.
  if (tree.type === 'hiddenAnchor' || tree.type === 'hiddenPost') {
    if (direction === 'down') {
      // Unfold all replies below.
      if (tree.replies?.length) {
        for (const reply of tree.replies) {
          yield* flattenTree(reply)
        }
      }
    }
  }
}

export function sortTrimThreadTreeExploration(
  n: ThreadTree,
  opts: SortTrimFlattenOptions,
): ThreadTree {
  if (!isNodeWithReplies(n)) {
    return n
  }
  const node: ThreadNodeWithReplies = n

  if (node.replies) {
    node.replies.sort((an: ThreadTree, bn: ThreadTree) => {
      if (!isPostNode(an)) {
        return 1
      }
      if (!isPostNode(bn)) {
        return -1
      }
      const aNode: ThreadMaybeOtherPostNode = an
      const bNode: ThreadMaybeOtherPostNode = bn

      // First applies bumping.
      const bump = applyBumpingExploration(aNode, bNode, opts)
      if (bump !== null) {
        return bump
      }

      // Then applies sorting.
      return applySortingExploration(aNode, bNode, opts)
    })

    // Trimming: after sorting, apply branching factor to all levels of replies except the anchor direct replies.
    if (node.item.depth !== 0) {
      node.replies = node.replies.slice(0, opts.branchingFactor)
    }

    node.replies.forEach((reply) => sortTrimThreadTreeExploration(reply, opts))
  }

  return node
}

function applyBumpingExploration(
  aNode: ThreadMaybeOtherPostNode,
  bNode: ThreadMaybeOtherPostNode,
  opts: SortTrimFlattenOptions,
): number | null {
  if (!isPostNode(aNode)) {
    return null
  }
  if (!isPostNode(bNode)) {
    return null
  }

  const { opDid, viewer } = opts

  type BumpDirection = 'up' | 'down'
  type BumpPredicateFn = (i: ThreadMaybeOtherPostNode) => boolean

  const maybeBump = (
    bump: BumpDirection,
    predicateFn: BumpPredicateFn,
  ): number | null => {
    const aPredicate = predicateFn(aNode)
    const bPredicate = predicateFn(bNode)
    if (aPredicate && bPredicate) {
      return applySortingExploration(aNode, bNode, opts)
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
    /*
      General bumps.
    */
    // OP replies.
    ['up', (i) => i.item.value.post.author.did === opDid],
    // Viewer replies.
    ['up', (i) => i.item.value.post.author.did === viewer],
  ]

  for (const [bump, predicateFn] of bumps) {
    const bumpResult = maybeBump(bump, predicateFn)
    if (bumpResult !== null) {
      return bumpResult
    }
  }

  return null
}

function applySortingExploration(
  aNode: ThreadMaybeOtherPostNode,
  bNode: ThreadMaybeOtherPostNode,
  opts: SortTrimFlattenOptions,
): number {
  const { visibilityTagRankPrefix: rp } = opts

  const a = aNode.item.value
  const ar = !rp ? 0 : parseRankFromTag(rp, findRankTag(aNode.tags, rp))
  const b = bNode.item.value
  const br = !rp ? 0 : parseRankFromTag(rp, findRankTag(bNode.tags, rp))

  // Only customize sort for visible posts.
  if (aNode.type === 'post' && bNode.type === 'post') {
    const { sort } = opts

    if (sort === 'oldest') {
      return a.post.indexedAt.localeCompare(b.post.indexedAt)
    }
    if (sort === 'top') {
      const aLikes = a.post.likeCount ?? 0
      const bLikes = b.post.likeCount ?? 0
      const aTop = topSortValue(aLikes, aNode.hasOPLike)
      const bTop = topSortValue(bLikes, bNode.hasOPLike)
      const aRank = aTop + ar
      const bRank = bTop + br
      if (aRank !== bRank) {
        return bRank - aRank
      }
    }
  }

  // Fallback to newest.
  return b.post.indexedAt.localeCompare(a.post.indexedAt)
}

function findRankTag(tags: Set<string>, prefix: string) {
  return Array.from(tags.values()).find((tag) => tag.startsWith(prefix))
}

function parseRankFromTag(prefix: string, tag?: string) {
  if (!tag) return 0

  try {
    const rank = parseInt(tag.slice(prefix.length), 10)
    if (typeof rank !== 'number' || isNaN(rank)) {
      return 0
    }
    return rank
  } catch (e) {
    return 0
  }
}
