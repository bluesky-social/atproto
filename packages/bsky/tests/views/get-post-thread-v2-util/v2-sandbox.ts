import {
  AppBskyFeedDefs,
  AppBskyFeedGetPostThread,
  AppBskyFeedPost,
  moderatePost,
  ModerationDecision,
  ModerationOpts,
  BskyThreadViewPreference,
  asPredicate,
} from '@atproto/api'

const REPLY_TREE_DEPTH = 10

const isPostRecord = asPredicate(AppBskyFeedPost.validateRecord)

export type ThreadViewPreferences = Pick<
  BskyThreadViewPreference,
  'prioritizeFollowedUsers'
> & {
  sort: 'hotness' | 'oldest' | 'newest' | 'most-likes' | 'random' | string
  lab_treeViewEnabled?: boolean
}

type ThreadViewNode = AppBskyFeedGetPostThread.OutputSchema['thread']

export interface ThreadCtx {
  depth: number
  isHighlightedPost?: boolean
  hasMore?: boolean
  isSelfThread?: boolean
  hasMoreSelfThread?: boolean
}

export type ThreadPost = {
  type: 'post'
  uri: string
  post: AppBskyFeedDefs.PostView
  parent: ThreadNode | undefined
  replies: ThreadNode[] | undefined
  depth: number
  isHighlighted?: boolean
  isOPThread?: boolean
  hasOPLike: boolean | undefined
  hasUnhydratedReplies?: boolean
}

export type ThreadNotFound = {
  type: 'not-found'
  uri: string
  depth: number
}

export type ThreadBlocked = {
  type: 'blocked'
  uri: string
  depth: number
}

export type ThreadUnknown = {
  type: 'unknown'
  uri: string
}

export type ThreadNode =
  | ThreadPost
  | ThreadNotFound
  | ThreadBlocked
  | ThreadUnknown

export type ThreadModerationCache = WeakMap<ThreadNode, ModerationDecision>

export type PostThreadQueryData = {
  thread: ThreadNode
  threadgate?: AppBskyFeedDefs.ThreadgateView
}

export function fillThreadModerationCache(
  cache: ThreadModerationCache,
  node: ThreadNode,
  moderationOpts: ModerationOpts,
) {
  if (node.type === 'post') {
    cache.set(node, moderatePost(node.post, moderationOpts))
    if (node.parent) {
      fillThreadModerationCache(cache, node.parent, moderationOpts)
    }
    if (node.replies) {
      for (const reply of node.replies) {
        fillThreadModerationCache(cache, reply, moderationOpts)
      }
    }
  }
}

export function sortThread({
  node,
  options,
  viewerDid,
  fetchedAt,
}: {
  node: ThreadNode
  options: ThreadViewPreferences
  viewerDid: string | undefined
  fetchedAt: number
}): ThreadNode {
  if (node.type !== 'post') {
    return node
  }
  if (node.replies) {
    node.replies.sort((a: ThreadNode, b: ThreadNode) => {
      if (a.type !== 'post') {
        return 1
      }
      if (b.type !== 'post') {
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
        const aHotness = getHotness(a, fetchedAt)
        const bHotness = getHotness(b, fetchedAt)
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
      sortThread({
        node: reply,
        options,
        viewerDid,
        fetchedAt,
      }),
    )
  }
  return node
}

// internal methods
// =

// Inspired by https://join-lemmy.org/docs/contributors/07-ranking-algo.html
// We want to give recent comments a real chance (and not bury them deep below the fold)
// while also surfacing well-liked comments from the past. In the future, we can explore
// something more sophisticated, but we don't have much data on the client right now.
function getHotness(threadPost: ThreadPost, fetchedAt: number) {
  const { post, hasOPLike } = threadPost
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

export function responseToThreadNodes(
  node: ThreadViewNode,
  depth = 0,
  direction: 'up' | 'down' | 'start' = 'start',
): ThreadNode {
  if (
    AppBskyFeedDefs.isThreadViewPost(node) &&
    isPostRecord(node.post.record)
  ) {
    return {
      type: 'post',
      uri: node.post.uri,
      post: node.post,
      parent:
        node.parent && direction !== 'down'
          ? responseToThreadNodes(node.parent, depth - 1, 'up')
          : undefined,
      replies:
        node.replies?.length && direction !== 'up'
          ? node.replies
              .map((reply) => responseToThreadNodes(reply, depth + 1, 'down'))
              // do not show blocked posts in replies
              .filter((node) => node.type !== 'blocked')
          : undefined,
      hasOPLike: Boolean(node?.threadContext?.rootAuthorLike),
      depth,
      isHighlighted: depth === 0,
      isOPThread: false, // populated `annotateSelfThread`
      // TODO reply depth?
      hasUnhydratedReplies: direction === 'down' && depth === REPLY_TREE_DEPTH && !node.replies?.length && !!node.post.replyCount,
    }
  } else if (AppBskyFeedDefs.isBlockedPost(node)) {
    return { type: 'blocked', uri: node.uri, depth, }
  } else if (AppBskyFeedDefs.isNotFoundPost(node)) {
    return { type: 'not-found', uri: node.uri, depth, }
  } else {
    return { type: 'unknown', uri: '' }
  }
}

function annotateSelfThread(thread: ThreadNode, {
  opDid,
}: {
  opDid: string
}) {
  if (thread.type !== 'post') {
    return
  }
  const parentsByOP: ThreadPost[] = [thread]

  /*
   * Walk up parents
   */
  let parent: ThreadNode | undefined = thread.parent
  while (parent) {
    if (
      parent.type !== 'post' ||
      parent.post.author.did !== opDid
    ) {
      // not a self-thread
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

  function walkReplies(node: ThreadNode) {
    if (node.type !== 'post') {
      return
    }
    if (node.replies?.length) {
      for (const reply of node.replies) {
        if (reply.type === 'post' && reply.post.author.did === opDid) {
          reply.isOPThread = true
          walkReplies(reply)
        }
      }
    }
  }

  walkReplies(thread)
}

const REPLY_PROMPT = { _reactKey: '__reply__' }
const LOAD_MORE = { _reactKey: '__load_more__' }
const SHOW_HIDDEN_REPLIES = { _reactKey: '__show_hidden_replies__' }
const SHOW_MUTED_REPLIES = { _reactKey: '__show_muted_replies__' }

enum HiddenRepliesState {
  Hide,
  Show,
  ShowAndOverridePostHider,
}

type YieldedItem =
  | ThreadPost
  | ThreadBlocked
  | ThreadNotFound
  | typeof SHOW_HIDDEN_REPLIES
  | typeof SHOW_MUTED_REPLIES
type RowItem =
  | YieldedItem
  // TODO: TS doesn't actually enforce it's one of these, it only enforces matching shape.
  | typeof REPLY_PROMPT
  | typeof LOAD_MORE

type ThreadSkeletonParts = {
  parents: YieldedItem[]
  highlightedPost: ThreadNode
  replies: YieldedItem[]
}

export function createThreadSkeleton(
  node: ThreadNode,
  viewerDid: string | undefined,
  treeView: boolean,
): ThreadSkeletonParts | null {
  if (!node) return null

  return {
    parents: Array.from(flattenThreadParents(node, !!viewerDid)),
    highlightedPost: node,
    replies: Array.from(flattenThreadReplies(node, viewerDid, treeView)),
  }
}

function* flattenThreadParents(
  node: ThreadNode,
  hasSession: boolean,
): Generator<YieldedItem, void> {
  if (node.type === 'post') {
    if (node.parent) {
      yield* flattenThreadParents(node.parent, hasSession)
    }
    if (!node.isHighlighted) {
      yield node
    }
  } else if (node.type === 'not-found') {
    yield node
  } else if (node.type === 'blocked') {
    yield node
  }
}

// The enum is ordered to make them easy to merge
enum HiddenReplyType {
  None = 0,
  Muted = 1,
  Hidden = 2,
}

function* flattenThreadReplies(
  node: ThreadNode,
  viewerDid: string | undefined,
  treeView: boolean,
): Generator<YieldedItem, HiddenReplyType> {
  if (node.type === 'post') {
    // dont show pwi-opted-out posts to logged out users
    if (!viewerDid && hasPwiOptOut(node)) {
      return HiddenReplyType.None
    }

    if (!node.isHighlighted) {
      yield node
    }

    if (node.replies?.length) {
      let hiddenReplies = HiddenReplyType.None
      for (const reply of node.replies) {
        let hiddenReply = yield* flattenThreadReplies(
          reply,
          viewerDid,
          treeView,
        )
        if (hiddenReply > hiddenReplies) {
          hiddenReplies = hiddenReply
        }
        if (!treeView && !node.isHighlighted) {
          break
        }
      }

      // show control to enable hidden replies
      if (node.depth === 0) {
        if (hiddenReplies === HiddenReplyType.Muted) {
          yield SHOW_MUTED_REPLIES
        } else if (hiddenReplies === HiddenReplyType.Hidden) {
          yield SHOW_HIDDEN_REPLIES
        }
      }
    }
  } else if (node.type === 'not-found') {
    yield node
  } else if (node.type === 'blocked') {
    yield node
  }
  return HiddenReplyType.None
}

function hasPwiOptOut(node: ThreadPost) {
  return !!node.post.author.labels?.find((l) => l.val === '!no-unauthenticated')
}

export function sandbox(data: AppBskyFeedGetPostThread.OutputSchema['thread'], {
  opDid,
  viewerDid,
  sort,
  prioritizeFollowedUsers,
}: {
  opDid: string
  viewerDid: string | undefined
  sort: ThreadViewPreferences['sort']
  prioritizeFollowedUsers: ThreadViewPreferences['prioritizeFollowedUsers']
}) {
  const thread = responseToThreadNodes(data)
  annotateSelfThread(thread, {opDid})
  const sorted = sortThread({
    node: thread,
    options: {
      sort,
      prioritizeFollowedUsers,
    },
    viewerDid,
    fetchedAt: Date.now(),
  })
  const skeleton = createThreadSkeleton(
    sorted,
    viewerDid,
    false,
  )
  return skeleton
}
