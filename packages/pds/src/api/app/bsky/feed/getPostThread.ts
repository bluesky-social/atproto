import assert from 'node:assert'
import { l } from '@atproto/lex'
import { AtUri, AtUriString } from '@atproto/syntax'
import { Server, XRPCError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalViewer,
  MungeFn,
  RecordDescript,
  formatMungedResponse,
  getLocalLag,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.add(app.bsky.feed.getPostThread, {
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.feed.getPostThread.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      try {
        return await pipethroughReadAfterWrite(
          ctx,
          reqCtx,
          app.bsky.feed.getPostThread,
          getPostThreadMunge,
        )
      } catch (err) {
        if (err instanceof XRPCError && err.error === 'NotFound') {
          const { auth, params } = reqCtx
          const requester = auth.credentials.did

          const rev = err.headers?.get('atproto-repo-rev')
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

const getPostThreadMunge: MungeFn<
  app.bsky.feed.getPostThread.OutputBody
> = async (localViewer, original, local) => {
  // @TODO if is NotFoundPost, handle similarly to error
  // @NOTE not necessary right now as we never return those for the requested uri
  if (!app.bsky.feed.defs.threadViewPost.$matches(original.thread)) {
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
  original: l.$Typed<app.bsky.feed.defs.ThreadViewPost>,
  posts: RecordDescript<app.bsky.feed.post.Main>[],
) => {
  const inThread = findPostsInThread(original, posts)
  if (inThread.length === 0) return original
  let thread: l.$Typed<app.bsky.feed.defs.ThreadViewPost> = original
  for (const record of inThread) {
    thread = await insertIntoThreadReplies(localViewer, thread, record)
  }
  return thread
}

const findPostsInThread = (
  thread: app.bsky.feed.defs.ThreadViewPost,
  posts: RecordDescript<app.bsky.feed.post.Main>[],
): RecordDescript<app.bsky.feed.post.Main>[] => {
  return posts.filter((post) => {
    const rootUri = post.record.reply?.root.uri
    if (!rootUri) return false
    if (rootUri === thread.post.uri) return true
    return (
      (thread.post.record as app.bsky.feed.post.Main).reply?.root.uri ===
      rootUri
    )
  })
}

const insertIntoThreadReplies = async (
  localViewer: LocalViewer,
  view: l.$Typed<app.bsky.feed.defs.ThreadViewPost>,
  descript: RecordDescript<app.bsky.feed.post.Main>,
): Promise<l.$Typed<app.bsky.feed.defs.ThreadViewPost>> => {
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
      app.bsky.feed.defs.threadViewPost.$matches(reply)
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
  descript: RecordDescript<app.bsky.feed.post.Main>,
): Promise<l.$Typed<app.bsky.feed.defs.ThreadViewPost> | null> => {
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
  params: app.bsky.feed.getPostThread.Params,
  requester: string,
  rev: string,
  resolvedUri: AtUri,
): Promise<{
  data: app.bsky.feed.getPostThread.OutputBody
  lag?: number
} | null> => {
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
      assert(ctx.bskyAppView)
      const parentsRes = await ctx.bskyAppView.client.call(
        app.bsky.feed.getPostThread.main,
        { uri: highestParent, parentHeight: params.parentHeight, depth: 0 },
        await ctx.appviewAuthHeaders(
          requester,
          app.bsky.feed.getPostThread.$lxm,
        ),
      )
      thread.parent = parentsRes.thread
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

const getHighestParent = (
  thread: app.bsky.feed.defs.ThreadViewPost,
): AtUriString | undefined => {
  while (
    thread.parent &&
    app.bsky.feed.defs.threadViewPost.$isTypeOf(thread.parent)
  ) {
    thread = thread.parent
  }

  // @NOTE we might get away with type casting here, but being safe to avoid
  // potential issues
  if (!app.bsky.feed.post.$matches(thread.post.record)) {
    return undefined
  }

  return thread.post.record.reply?.parent.uri
}
