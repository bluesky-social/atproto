import {
  AppBskyFeedDefs,
  AppBskyFeedGetPostThread,
  AppBskyFeedPost,
  BskyThreadViewPreference,
  asPredicate,
} from '@atproto/api'

const REPLY_TREE_DEPTH = 10

const isPostRecord = asPredicate(AppBskyFeedPost.validateRecord)

export type ThreadViewPreferences = Pick<
  BskyThreadViewPreference,
  'prioritizeFollowedUsers'
> & {
  sort: 'hotness' | 'oldest' | 'newest' | 'most-likes' | string
  lab_treeViewEnabled?: boolean
}

type ThreadSlice =
  | {
      $type: 'post'
      uri: string
      post: AppBskyFeedDefs.PostView
      parent: Exclude<ThreadSlice, { $type: 'unknown' }> | undefined
      replies: Exclude<ThreadSlice, { $type: 'unknown' }>[] | undefined
      depth: number
      isHighlighted: boolean
      isOPThread: boolean
      hasOPLike: boolean
      hasUnhydratedReplies: boolean
    }
  | {
      $type: 'postNotFound'
      uri: string
      depth: number
    }
  | {
      $type: 'postBlocked'
      uri: string
      depth: number
    }
  | {
      $type: 'postNoUnauthenticated'
      uri: string
      depth: number
    }
  | {
      $type: 'unknown'
    }

export function postThreadView({
  thread,
  depth = 0,
  direction,
}: {
  thread: AppBskyFeedGetPostThread.OutputSchema['thread']
  depth: number
  direction?: 'up' | 'down'
}): ThreadSlice {
  if (
    AppBskyFeedDefs.isThreadViewPost(thread) &&
    isPostRecord(thread.post.record)
  ) {
    const parent =
      thread.parent && direction !== 'down'
        ? postThreadView({
            thread: thread.parent,
            depth: depth - 1,
            direction: 'up',
          })
        : undefined
    return {
      $type: 'post',
      uri: thread.post.uri,
      post: thread.post,
      parent: parent && parent.$type !== 'post' ? undefined : parent,
      replies:
        thread.replies?.length && direction !== 'up'
          ? thread.replies
              .map((reply) =>
                postThreadView({
                  thread: reply,
                  depth: depth + 1,
                  direction: 'down',
                }),
              )
              // TODO only return posts?
              .filter((thread) => thread.$type !== 'unknown')
          : undefined,
      hasOPLike: Boolean(thread?.threadContext?.rootAuthorLike),
      depth,
      isHighlighted: depth === 0,
      isOPThread: false, // populated `annotateSelfThread`
      hasUnhydratedReplies:
        direction === 'down' &&
        depth === REPLY_TREE_DEPTH &&
        !thread.replies?.length &&
        !!thread.post.replyCount,
    }
  } else if (AppBskyFeedDefs.isNotFoundPost(thread)) {
    // TODO test 404
    return { $type: 'postNotFound', uri: thread.uri, depth }
  } else if (AppBskyFeedDefs.isBlockedPost(thread)) {
    // TODO test blocked
    return { $type: 'postBlocked', uri: thread.uri, depth }
  } else {
    return { $type: 'unknown' }
  }
}

function* flattenThreadView({
  thread,
  isAuthenticated,
  direction,
}: {
  thread: ThreadSlice
  isAuthenticated: boolean
  direction: 'up' | 'down'
}): Generator<Exclude<ThreadSlice, { $type: 'unknown' }>, void> {
  if (thread.$type === 'post') {
    if (direction === 'up') {
      if (thread.parent) {
        yield* flattenThreadView({
          thread: thread.parent,
          isAuthenticated,
          direction: 'up',
        })
      }

      if (!thread.isHighlighted) {
        yield thread
      }
    } else {
      const isNoUnauthenticated = !!thread.post.author.labels?.find(
        (l) => l.val === '!no-unauthenticated',
      )
      if (!isAuthenticated && isNoUnauthenticated) {
        // TODO we exit early atm
        // return HiddenReplyType.None
        yield {
          $type: 'postNoUnauthenticated',
          uri: thread.uri,
          depth: thread.depth,
        }
      }

      if (!thread.isHighlighted) {
        yield thread
      }

      if (thread.replies?.length) {
        for (const reply of thread.replies) {
          yield* flattenThreadView({
            thread: reply,
            isAuthenticated,
            direction: 'down',
          })
          // TODO what
          if (!thread.isHighlighted) {
            break
          }
        }
      }
    }
  } else if (thread.$type === 'postNotFound') {
    yield thread
  } else if (thread.$type === 'postBlocked') {
    yield thread
  }
}

function annotateOPThread(
  thread: ThreadSlice,
  {
    opDid,
  }: {
    opDid: string
  },
) {
  if (thread.$type !== 'post') {
    return
  }
  const parentsByOP: Extract<ThreadSlice, { $type: 'post' }>[] = [thread]

  /*
   * Walk up parents
   */
  let parent: ThreadSlice | undefined = thread.parent
  while (parent) {
    if (parent.$type !== 'post' || parent.post.author.did !== opDid) {
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

  function walkReplies(node: ThreadSlice) {
    if (node.$type !== 'post') {
      return
    }
    if (node.replies?.length) {
      for (const reply of node.replies) {
        if (reply.$type === 'post' && reply.post.author.did === opDid) {
          reply.isOPThread = true
          walkReplies(reply)
        }
      }
    }
  }

  walkReplies(thread)
}

export function sortThreadView({
  node,
  options,
  viewerDid,
  fetchedAt,
}: {
  node: ThreadSlice
  options: ThreadViewPreferences
  viewerDid: string | undefined
  fetchedAt: number
}): ThreadSlice {
  if (node.$type !== 'post') {
    return node
  }
  if (node.replies) {
    node.replies.sort((a: ThreadSlice, b: ThreadSlice) => {
      if (a.$type !== 'post') {
        return 1
      }
      if (b.$type !== 'post') {
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
        const aHotness = getSliceHotness(a, fetchedAt)
        const bHotness = getSliceHotness(b, fetchedAt)
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
      sortThreadView({
        node: reply,
        options,
        viewerDid,
        fetchedAt,
      }),
    )
  }
  return node
}

// Inspired by https://join-lemmy.org/docs/contributors/07-ranking-algo.html
// We want to give recent comments a real chance (and not bury them deep below the fold)
// while also surfacing well-liked comments from the past. In the future, we can explore
// something more sophisticated, but we don't have much data on the client right now.
function getSliceHotness(thread: ThreadSlice, fetchedAt: number) {
  if (thread.$type !== 'post') return 0

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

export function run(
  data: AppBskyFeedGetPostThread.OutputSchema['thread'],
  {
    opDid,
    viewerDid,
    sort,
    prioritizeFollowedUsers,
  }: {
    opDid: string
    viewerDid: string | undefined
    sort: ThreadViewPreferences['sort']
    prioritizeFollowedUsers: ThreadViewPreferences['prioritizeFollowedUsers']
  },
) {
  const thread = postThreadView({
    thread: data,
    depth: 0,
  })
  annotateOPThread(thread, { opDid })
  const sorted = sortThreadView({
    node: thread,
    options: {
      sort,
      prioritizeFollowedUsers,
    },
    viewerDid,
    fetchedAt: Date.now(),
  })
  const parents = Array.from(
    flattenThreadView({
      thread: sorted,
      isAuthenticated: !!viewerDid,
      direction: 'up',
    }),
  )
  const replies = Array.from(
    flattenThreadView({
      thread: sorted,
      isAuthenticated: !!viewerDid,
      direction: 'down',
    }),
  )
  return {
    parents,
    highlightedPost: thread,
    replies,
  }
}
