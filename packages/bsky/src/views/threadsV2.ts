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
      const a = aTree.item.value
      const b = bTree.item.value

      // First applies bumping.
      const bump = applyBump(a, b, opts)
      if (bump !== null) {
        return bump
      }

      // Then applies sorting.
      return applySorting(a, b, opts)
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

function applyBump(
  a: $Typed<ThreadItemPost>,
  b: $Typed<ThreadItemPost>,
  opts: SortTrimFlattenOptions,
): number | null {
  const { opDid, prioritizeFollowedUsers, viewer } = opts

  const maybeBump = (
    aPredicate: boolean,
    bPredicate: boolean,
    bump: 'up' | 'down',
  ): number | null => {
    if (aPredicate && bPredicate) {
      return applySorting(a, b, opts)
    } else if (aPredicate) {
      return bump === 'up' ? -1 : 1
    } else if (bPredicate) {
      return bump === 'up' ? 1 : -1
    }
    return null
  }

  // OP replies ⬆️.
  const aOp = a.post.author.did === opDid
  const bOp = b.post.author.did === opDid
  const bumpOp = maybeBump(aOp, bOp, 'up')
  if (bumpOp !== null) {
    return bumpOp
  }

  // Viewer replies ⬆️.
  const aViewer = a.post.author.did === viewer
  const bViewer = b.post.author.did === viewer
  const bumpViewer = maybeBump(aViewer, bViewer, 'up')
  if (bumpViewer !== null) {
    return bumpViewer
  }

  // Muted posts ⬇️.
  const aMuted = a.isMuted
  const bMuted = b.isMuted
  const bumpMuted = maybeBump(aMuted, bMuted, 'down')
  if (bumpMuted !== null) {
    return bumpMuted
  }

  // Pushpin-only posts ⬇️.
  if (isPostRecord(a.post.record) && isPostRecord(b.post.record)) {
    const aPin = Boolean(a.post.record.text.trim() === '📌')
    const bPin = Boolean(b.post.record.text.trim() === '📌')
    const bumpPin = maybeBump(aPin, bPin, 'down')
    if (bumpPin !== null) {
      return bumpPin
    }
  }

  // Followers posts ⬆️.
  if (prioritizeFollowedUsers) {
    const aFollowed = a.post.author.viewer?.following
    const bFollowed = b.post.author.viewer?.following
    const bumpFollowed = maybeBump(!!aFollowed, !!bFollowed, 'up')
    if (bumpFollowed !== null) {
      return bumpFollowed
    }
  }

  return null
}

function applySorting(
  a: $Typed<ThreadItemPost>,
  b: $Typed<ThreadItemPost>,
  { sorting }: SortTrimFlattenOptions,
): number {
  if (sorting === 'app.bsky.unspecced.getPostThreadV2#oldest') {
    return a.post.indexedAt.localeCompare(b.post.indexedAt)
  }
  if (sorting === 'app.bsky.unspecced.getPostThreadV2#top') {
    // Currently it is just a comparison of like count.
    if (a.post.likeCount !== b.post.likeCount) {
      return (b.post.likeCount || 0) - (a.post.likeCount || 0)
    }
  }

  // Newest.
  return b.post.indexedAt.localeCompare(a.post.indexedAt)
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
