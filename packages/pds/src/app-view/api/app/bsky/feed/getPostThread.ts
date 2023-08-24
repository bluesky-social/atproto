import { AtUri } from '@atproto/uri'
import { AppBskyFeedGetPostThread } from '@atproto/api'
import { Headers } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import {
  ActorInfoMap,
  PostEmbedViews,
  FeedRow,
  FeedService,
  PostInfoMap,
  PostBlocksMap,
} from '../../../../services/feed'
import {
  getAncestorsAndSelfQb,
  getDescendentsQb,
} from '../../../../services/feed/util'
import { Labels } from '../../../../services/label'
import {
  BlockedPost,
  NotFoundPost,
  ThreadViewPost,
  isNotFoundPost,
  isThreadViewPost,
} from '../../../../../lexicon/types/app/bsky/feed/defs'
import { Record as PostRecord } from '../../../../../lexicon/types/app/bsky/feed/post'
import {
  OutputSchema,
  QueryParams,
} from '../../../../../lexicon/types/app/bsky/feed/getPostThread'
import {
  LocalRecords,
  LocalService,
  RecordDescript,
} from '../../../../../services/local'
import {
  getLocalLag,
  getRepoRev,
  handleReadAfterWrite,
} from '../util/read-after-write'

export type PostThread = {
  post: FeedRow
  parent?: PostThread | ParentNotFoundError
  replies?: PostThread[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (await ctx.canProxyRead(req, requester)) {
        try {
          const res = await ctx.appviewAgent.api.app.bsky.feed.getPostThread(
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
      }

      const { uri, depth, parentHeight } = params

      const feedService = ctx.services.appView.feed(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const threadData = await getThreadData(ctx, uri, depth, parentHeight)
      if (!threadData) {
        throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      }
      const relevant = getRelevantIds(threadData)
      const [actors, posts, labels] = await Promise.all([
        feedService.getActorInfos(Array.from(relevant.dids), requester, {
          skipLabels: true,
        }),
        feedService.getPostInfos(Array.from(relevant.uris), requester),
        labelService.getLabelsForSubjects([...relevant.uris, ...relevant.dids]),
      ])
      const blocks = await feedService.blocksForPosts(posts)
      const embeds = await feedService.embedsForPosts(posts, blocks, requester)

      const thread = composeThread(
        threadData,
        feedService,
        posts,
        actors,
        embeds,
        blocks,
        labels,
      )

      if (isNotFoundPost(thread)) {
        // @TODO technically this could be returned as a NotFoundPost based on lexicon
        throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      }

      return {
        encoding: 'application/json',
        body: { thread },
      }
    },
  })
}

const composeThread = (
  threadData: PostThread,
  feedService: FeedService,
  posts: PostInfoMap,
  actors: ActorInfoMap,
  embeds: PostEmbedViews,
  blocks: PostBlocksMap,
  labels: Labels,
): ThreadViewPost | NotFoundPost | BlockedPost => {
  const post = feedService.views.formatPostView(
    threadData.post.postUri,
    actors,
    posts,
    embeds,
    labels,
  )

  if (!post || blocks[post.uri]?.reply) {
    return {
      $type: 'app.bsky.feed.defs#notFoundPost',
      uri: threadData.post.postUri,
      notFound: true,
    }
  }

  if (post.author.viewer?.blocking || post.author.viewer?.blockedBy) {
    return {
      $type: 'app.bsky.feed.defs#blockedPost',
      uri: threadData.post.postUri,
      blocked: true,
      author: {
        did: post.author.did,
        viewer: post.author.viewer
          ? {
              blockedBy: post.author.viewer?.blockedBy,
              blocking: post.author.viewer?.blocking,
            }
          : undefined,
      },
    }
  }

  let parent: ThreadViewPost | NotFoundPost | BlockedPost | undefined
  if (threadData.parent) {
    if (threadData.parent instanceof ParentNotFoundError) {
      parent = {
        $type: 'app.bsky.feed.defs#notFoundPost',
        uri: threadData.parent.uri,
        notFound: true,
      }
    } else {
      parent = composeThread(
        threadData.parent,
        feedService,
        posts,
        actors,
        embeds,
        blocks,
        labels,
      )
    }
  }

  let replies: (ThreadViewPost | NotFoundPost | BlockedPost)[] | undefined
  if (threadData.replies) {
    replies = threadData.replies.flatMap((reply) => {
      const thread = composeThread(
        reply,
        feedService,
        posts,
        actors,
        embeds,
        blocks,
        labels,
      )
      // e.g. don't bother including #postNotFound reply placeholders for takedowns. either way matches api contract.
      const skip = []
      return isNotFoundPost(thread) ? skip : thread
    })
  }

  return {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post,
    parent,
    replies,
  }
}

const getRelevantIds = (
  thread: PostThread,
): { dids: Set<string>; uris: Set<string> } => {
  const dids = new Set<string>()
  const uris = new Set<string>()
  if (thread.parent && !(thread.parent instanceof ParentNotFoundError)) {
    const fromParent = getRelevantIds(thread.parent)
    fromParent.dids.forEach((did) => dids.add(did))
    fromParent.uris.forEach((uri) => uris.add(uri))
  }
  if (thread.replies) {
    for (const reply of thread.replies) {
      const fromChild = getRelevantIds(reply)
      fromChild.dids.forEach((did) => dids.add(did))
      fromChild.uris.forEach((uri) => uris.add(uri))
    }
  }
  dids.add(thread.post.postAuthorDid)
  uris.add(thread.post.postUri)
  return { dids, uris }
}

const getThreadData = async (
  ctx: AppContext,
  uri: string,
  depth: number,
  parentHeight: number,
): Promise<PostThread | null> => {
  const feedService = ctx.services.appView.feed(ctx.db)
  const [parents, children] = await Promise.all([
    getAncestorsAndSelfQb(ctx.db.db, { uri, parentHeight })
      .selectFrom('ancestor')
      .innerJoin(
        feedService.selectPostQb().as('post'),
        'post.uri',
        'ancestor.uri',
      )
      .selectAll('post')
      .execute(),
    getDescendentsQb(ctx.db.db, { uri, depth })
      .selectFrom('descendent')
      .innerJoin(
        feedService.selectPostQb().as('post'),
        'post.uri',
        'descendent.uri',
      )
      .selectAll('post')
      .orderBy('sortAt', 'desc')
      .execute(),
  ])
  const parentsByUri = parents.reduce((acc, parent) => {
    return Object.assign(acc, { [parent.postUri]: parent })
  }, {} as Record<string, FeedRow>)
  const childrenByParentUri = children.reduce((acc, child) => {
    if (!child.replyParent) return acc
    acc[child.replyParent] ??= []
    acc[child.replyParent].push(child)
    return acc
  }, {} as Record<string, FeedRow[]>)
  const post = parentsByUri[uri]
  if (!post) return null
  return {
    post,
    parent: post.replyParent
      ? getParentData(parentsByUri, post.replyParent, parentHeight)
      : undefined,
    replies: getChildrenData(childrenByParentUri, uri, depth),
  }
}

const getParentData = (
  postsByUri: Record<string, FeedRow>,
  uri: string,
  depth: number,
): PostThread | ParentNotFoundError | undefined => {
  if (depth === 0) return undefined
  const post = postsByUri[uri]
  if (!post) return new ParentNotFoundError(uri)
  return {
    post,
    parent: post.replyParent
      ? getParentData(postsByUri, post.replyParent, depth - 1)
      : undefined,
    replies: [],
  }
}

const getChildrenData = (
  childrenByParentUri: Record<string, FeedRow[]>,
  uri: string,
  depth: number,
): PostThread[] | undefined => {
  if (depth === 0) return undefined
  const children = childrenByParentUri[uri] ?? []
  return children.map((row) => ({
    post: row,
    replies: getChildrenData(childrenByParentUri, row.postUri, depth - 1),
  }))
}

class ParentNotFoundError extends Error {
  constructor(public uri: string) {
    super(`Parent not found: ${uri}`)
  }
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
      const parentsRes = await ctx.appviewAgent.api.app.bsky.feed.getPostThread(
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
