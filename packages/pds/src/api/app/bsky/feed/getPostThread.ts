import assert from 'node:assert'
import { AtUri } from '@atproto/syntax'
import { XRPCError } from '@atproto/xrpc'

import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  ThreadViewPost,
  isThreadViewPost,
} from '../../../../lexicon/types/app/bsky/feed/defs'
import { Record as PostRecord } from '../../../../lexicon/types/app/bsky/feed/post'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import {
  LocalViewer,
  getLocalLag,
  getRepoRev,
  LocalRecords,
  RecordDescript,
  pipethroughReadAfterWrite,
  formatMungedResponse,
} from '../../../../read-after-write'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.accessStandard(),
    handler: async (reqCtx) => {
      try {
        return await pipethroughReadAfterWrite(ctx, reqCtx, getPostThreadMunge)
      } catch (err) {
        if (err instanceof XRPCError && err.error === 'NotFound') {
          const { auth, params } = reqCtx
          const requester = auth.credentials.did

          const rev = err.headers && getRepoRev(err.headers)
          if (!rev) throw err

          const uri = new AtUri(params.uri)
          if (!uri.hostname.startsWith('did:')) {
            const account = await ctx.accountManager.getAccount(uri.hostname)
            if (account) {
              uri.hostname = account.did
            }
          }
          if (uri.hostname !== requester) throw err

          const local = await ctx.actorStore.read(requester, (store) => {
            const localViewer = ctx.localViewer(store)
            return readAfterWriteNotFound(
              ctx,
              localViewer,
              params,
              requester,
              rev,
              uri,
            )
          })
          if (local === null) {
            throw err
          } else {
            return formatMungedResponse(local.data, local.lag)
          }
        } else {
          throw err
        }
      }
    },
  })
}

// READ AFTER WRITE
// ----------------

const getPostThreadMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  // @TODO if is NotFoundPost, handle similarly to error
  // @NOTE not necessary right now as we never return those for the requested uri
  if (!isThreadViewPost(original.thread)) {
    return original
  }
  const thread = await addPostsToThread(
    localViewer,
    original.thread,
    local.posts,
  )
  return {
    ...original,
    thread,
  }
}

const addPostsToThread = async (
  localViewer: LocalViewer,
  original: ThreadViewPost,
  posts: RecordDescript<PostRecord>[],
) => {
  const inThread = findPostsInThread(original, posts)
  if (inThread.length === 0) return original
  let thread: ThreadViewPost = original
  for (const record of inThread) {
    thread = await insertIntoThreadReplies(localViewer, thread, record)
  }
  return thread
}

const findPostsInThread = (
  thread: ThreadViewPost,
  posts: RecordDescript<PostRecord>[],
): RecordDescript<PostRecord>[] => {
  return posts.filter((post) => {
    const rootUri = post.record.reply?.root.uri
    if (!rootUri) return false
    if (rootUri === thread.post.uri) return true
    return (thread.post.record as PostRecord).reply?.root.uri === rootUri
  })
}

const insertIntoThreadReplies = async (
  localViewer: LocalViewer,
  view: ThreadViewPost,
  descript: RecordDescript<PostRecord>,
): Promise<ThreadViewPost> => {
  if (descript.record.reply?.parent.uri === view.post.uri) {
    const postView = await threadPostView(localViewer, descript)
    if (!postView) return view
    const replies = [postView, ...(view.replies ?? [])]
    return {
      ...view,
      replies,
    }
  }
  if (!view.replies) return view
  const replies = await Promise.all(
    view.replies.map(async (reply) =>
      isThreadViewPost(reply)
        ? await insertIntoThreadReplies(localViewer, reply, descript)
        : reply,
    ),
  )
  return {
    ...view,
    replies,
  }
}

const threadPostView = async (
  localViewer: LocalViewer,
  descript: RecordDescript<PostRecord>,
): Promise<ThreadViewPost | null> => {
  const postView = await localViewer.getPost(descript)
  if (!postView) return null
  return {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: postView,
  }
}

// Read after write on error
// ---------------------

const readAfterWriteNotFound = async (
  ctx: AppContext,
  localViewer: LocalViewer,
  params: QueryParams,
  requester: string,
  rev: string,
  resolvedUri: AtUri,
): Promise<{ data: OutputSchema; lag?: number } | null> => {
  if (resolvedUri.hostname !== requester) {
    return null
  }
  const local = await localViewer.getRecordsSinceRev(rev)
  const found = local.posts.find(
    (p) => p.uri.toString() === resolvedUri.toString(),
  )
  if (!found) return null
  let thread = await threadPostView(localViewer, found)
  if (!thread) return null
  const rest = local.posts.filter(
    (p) => p.uri.toString() !== resolvedUri.toString(),
  )
  thread = await addPostsToThread(localViewer, thread, rest)
  const highestParent = getHighestParent(thread)
  if (highestParent) {
    try {
      assert(ctx.appViewAgent)
      const parentsRes = await ctx.appViewAgent.api.app.bsky.feed.getPostThread(
        { uri: highestParent, parentHeight: params.parentHeight, depth: 0 },
        await ctx.appviewAuthHeaders(requester, ids.AppBskyFeedGetPostThread),
      )
      thread.parent = parentsRes.data.thread
    } catch (err) {
      // do nothing
    }
  }
  return {
    data: {
      thread,
    },
    lag: getLocalLag(local),
  }
}

const getHighestParent = (thread: ThreadViewPost): string | undefined => {
  if (isThreadViewPost(thread.parent)) {
    return getHighestParent(thread.parent)
  } else {
    return (thread.post.record as PostRecord).reply?.parent.uri
  }
}
