import { asPredicate } from '@atproto/api'
import { HydrateCtx } from '../hydration/hydrator'
import { validateRecord as validatePostRecord } from '../lexicon/types/app/bsky/feed/post'
import {
  ThreadHiddenItem,
  ThreadHiddenItemPost,
  isThreadHiddenItemPost,
} from '../lexicon/types/app/bsky/unspecced/getPostThreadHiddenV2'
import {
  QueryParams as GetPostThreadV2QueryParams,
  ThreadItem,
  ThreadItemBlocked,
  ThreadItemNoUnauthenticated,
  ThreadItemNotFound,
  ThreadItemPost,
} from '../lexicon/types/app/bsky/unspecced/getPostThreadV2'
import { $Typed } from '../lexicon/util'

type ThreadMaybeHiddenPostNode = ThreadPostNode | ThreadHiddenPostNode
type ThreadNodeWithReplies =
  | ThreadPostNode
  | ThreadHiddenPostNode
  | ThreadHiddenAnchorPostNode

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
  hasOPLike: boolean
  parent: ThreadTree | undefined
  replies: ThreadTree[] | undefined
}

type ThreadHiddenItemValue<T extends ThreadHiddenItem['value']> = Omit<
  ThreadHiddenItem,
  'value'
> & {
  value: T
}

export type ThreadHiddenItemValuePost = ThreadHiddenItemValue<
  $Typed<ThreadHiddenItemPost>
>

// This is an intermediary type that doesn't map to the views.
// It is useful to differentiate between the anchor post and the replies for the hidden case,
// while also differentiating between hidden and visible cases.
export type ThreadHiddenAnchorPostNode = {
  type: 'hiddenAnchor'
  item: Omit<ThreadHiddenItem, 'value'> & { value: undefined }
  replies: ThreadHiddenPostNode[] | undefined
}

export type ThreadHiddenPostNode = {
  type: 'hiddenPost'
  item: ThreadHiddenItemValuePost
  replies: ThreadHiddenPostNode[] | undefined
}

const isNodeWithReplies = (node: ThreadTree): node is ThreadNodeWithReplies =>
  'replies' in node && node.replies !== undefined

const isPostNode = (node: ThreadTree): node is ThreadMaybeHiddenPostNode =>
  node.type === 'post' || node.type === 'hiddenPost'

export type ThreadTreeVisible =
  | ThreadBlockedNode
  | ThreadNoUnauthenticatedNode
  | ThreadNotFoundNode
  | ThreadPostNode

export type ThreadTreeHidden = ThreadHiddenAnchorPostNode | ThreadHiddenPostNode

export type ThreadTree = ThreadTreeVisible | ThreadTreeHidden

/** This function mutates the tree parameter. */
export function sortTrimFlattenThreadTree<
  TItem extends ThreadItem | ThreadHiddenItem,
>(anchorTree: ThreadTree, options: SortTrimFlattenOptions): TItem[] {
  const sortedAnchorTree = sortTrimThreadTree(anchorTree, options)

  return flattenTree<TItem>(sortedAnchorTree)
}

type SortTrimFlattenOptions = {
  branchingFactor: GetPostThreadV2QueryParams['branchingFactor']
  fetchedAt: number
  opDid: string
  prioritizeFollowedUsers: boolean
  sort?: GetPostThreadV2QueryParams['sort']
  viewer: HydrateCtx['viewer']
}

const isPostRecord = asPredicate(validatePostRecord)

/** This function mutates the tree parameter. */
function sortTrimThreadTree(
  n: ThreadTree,
  opts: SortTrimFlattenOptions,
): ThreadTree {
  if (!isNodeWithReplies(n)) {
    return n
  }
  const node: ThreadNodeWithReplies = n

  const {
    branchingFactor,
    fetchedAt,
    opDid,
    prioritizeFollowedUsers,
    sort,
    viewer,
  } = opts

  if (node.replies) {
    node.replies.sort((an: ThreadTree, bn: ThreadTree) => {
      if (!isPostNode(an)) {
        return 1
      }
      if (!isPostNode(bn)) {
        return -1
      }
      const aNode: ThreadMaybeHiddenPostNode = an
      const bNode: ThreadMaybeHiddenPostNode = bn

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
      node.replies = node.replies.slice(0, branchingFactor)
    }

    node.replies.forEach((reply) =>
      sortTrimThreadTree(reply, {
        branchingFactor,
        fetchedAt,
        opDid,
        prioritizeFollowedUsers,
        sort,
        viewer,
      }),
    )
  }

  return node
}

function applyBumping(
  aNode: ThreadMaybeHiddenPostNode,
  bNode: ThreadMaybeHiddenPostNode,
  opts: SortTrimFlattenOptions,
): number | null {
  const a = aNode.item.value
  const b = bNode.item.value
  const { opDid, prioritizeFollowedUsers, viewer } = opts

  type BumpDirection = 'up' | 'down'
  type BumpPredicateFn = (i: ThreadItemPost | ThreadHiddenItemPost) => boolean

  const maybeBump = (
    bump: BumpDirection,
    predicateFn: BumpPredicateFn,
  ): number | null => {
    const aPredicate = predicateFn(a)
    const bPredicate = predicateFn(b)
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
    // OP replies.
    ['up', (i) => i.post.author.did === opDid],
    // Viewer replies.
    ['up', (i) => i.post.author.did === viewer],
    // Muted account by the viewer.
    ['down', (i) => isThreadHiddenItemPost(i) && i.mutedByViewer],
    // Hidden by threadgate.
    ['down', (i) => isThreadHiddenItemPost(i) && i.hiddenByThreadgate],
    // Pushpin-only.
    [
      'down',
      (i) => isPostRecord(i.post.record) && i.post.record.text.trim() === '📌',
    ],
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
  aNode: ThreadMaybeHiddenPostNode,
  bNode: ThreadMaybeHiddenPostNode,
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

function flattenTree<TItem extends ThreadItem | ThreadHiddenItem>(
  tree: ThreadTree,
): TItem[] {
  return [
    // All parents above.
    ...Array.from(
      flattenInDirection<TItem>({
        tree,
        direction: 'up',
      }),
    ),

    // The anchor.
    // In the case of hidden replies, the anchor item itself is undefined.
    ...(tree.item.value ? ([tree.item] as TItem[]) : []),

    // All replies below.
    ...Array.from(
      flattenInDirection<TItem>({
        tree,
        direction: 'down',
      }),
    ),
  ]
}

function* flattenInDirection<TItem extends ThreadItem | ThreadHiddenItem>({
  tree,
  direction,
}: {
  tree: ThreadTree
  direction: 'up' | 'down'
}): Generator<TItem, void> {
  if (tree.type === 'noUnauthenticated') {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenTree<TItem>(tree.parent)
      }
    }
  }

  if (tree.type === 'post') {
    if (direction === 'up') {
      if (tree.parent) {
        // Unfold all parents above.
        yield* flattenTree<TItem>(tree.parent)
      }
    } else {
      // Unfold all replies below.
      if (tree.replies?.length) {
        for (const reply of tree.replies) {
          yield* flattenTree<TItem>(reply)
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
          yield* flattenTree<TItem>(reply)
        }
      }
    }
  }
}
