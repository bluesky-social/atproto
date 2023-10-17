import { AtUri } from '@atproto/syntax'
import { AppBskyFeedGetPostThread } from '@atproto/api'
import { Headers } from '@atproto/xrpc'
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
  LocalRecords,
  LocalService,
  RecordDescript,
} from '../../../../services/local'
import {
  getLocalLag,
  getRepoRev,
  handleReadAfterWrite,
} from '../util/read-after-write'
import { authPassthru } from '../../../com/atproto/admin/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.accessOrRole,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null

      if (!requester) {
        const res = await ctx.appViewAgent.api.app.bsky.feed.getPostThread(
          params,
          authPassthru(req),
        )

        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      try {
        const res = await ctx.appViewAgent.api.app.bsky.feed.getPostThread(
          params,
          await ctx.serviceAuthHeaders(requester),
        )

        return await handleReadAfterWrite(
          ctx,
          requester,
          res,
          getPostThreadMunge,
        )
      } catch (err) {
        if (err instanceof AppBskyFeedGetPostThread.NotFoundError) {
          const local = await readAfterWriteNotFound(
            ctx,
            params,
            requester,
            err.headers,
          )
          if (local === null) {
            throw err
          } else {
            return {
              encoding: 'application/json',
              body: local.data,
              headers: local.lag
                ? {
                    'Atproto-Upstream-Lag': local.lag.toString(10),
                  }
                : undefined,
            }
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
  ctx: AppContext,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  // @TODO if is NotFoundPost, handle similarly to error
  // @NOTE not necessary right now as we never return those for the requested uri
  if (!isThreadViewPost(original.thread)) {
    return original
  }
  const thread = await addPostsToThread(
    ctx.services.local(ctx.db),
    original.thread,
    local.posts,
  )
  return {
    ...original,
    thread,
  }
}

const addPostsToThread = async (
  localSrvc: LocalService,
  original: ThreadViewPost,
  posts: RecordDescript<PostRecord>[],
) => {
  const inThread = findPostsInThread(original, posts)
  if (inThread.length === 0) return original
  let thread: ThreadViewPost = original
  for (const record of inThread) {
    thread = await insertIntoThreadReplies(localSrvc, thread, record)
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
  localSrvc: LocalService,
  view: ThreadViewPost,
  descript: RecordDescript<PostRecord>,
): Promise<ThreadViewPost> => {
  if (descript.record.reply?.parent.uri === view.post.uri) {
    const postView = await threadPostView(localSrvc, descript)
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
        ? await insertIntoThreadReplies(localSrvc, reply, descript)
        : reply,
    ),
  )
  return {
    ...view,
    replies,
  }
}

const threadPostView = async (
  localSrvc: LocalService,
  descript: RecordDescript<PostRecord>,
): Promise<ThreadViewPost | null> => {
  const postView = await localSrvc.getPost(descript)
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
  params: QueryParams,
  requester: string,
  headers?: Headers,
): Promise<{ data: OutputSchema; lag?: number } | null> => {
  if (!headers) return null
  const rev = getRepoRev(headers)
  if (!rev) return null
  const uri = new AtUri(params.uri)
  if (uri.hostname !== requester) {
    return null
  }
  const localSrvc = ctx.services.local(ctx.db)
  const local = await localSrvc.getRecordsSinceRev(requester, rev)
  const found = local.posts.find((p) => p.uri.toString() === uri.toString())
  if (!found) return null
  let thread = await threadPostView(localSrvc, found)
  if (!thread) return null
  const rest = local.posts.filter((p) => p.uri.toString() !== uri.toString())
  thread = await addPostsToThread(localSrvc, thread, rest)
  const highestParent = getHighestParent(thread)
  if (highestParent) {
    try {
      const parentsRes = await ctx.appViewAgent.api.app.bsky.feed.getPostThread(
        { uri: highestParent, parentHeight: params.parentHeight, depth: 0 },
        await ctx.serviceAuthHeaders(requester),
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
