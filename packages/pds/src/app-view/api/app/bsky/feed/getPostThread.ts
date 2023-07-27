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
import { Labels } from '../../../../services/label'
import {
  BlockedPost,
  NotFoundPost,
  ThreadViewPost,
  isNotFoundPost,
  isThreadViewPost,
} from '../../../../../lexicon/types/app/bsky/feed/defs'
import { Record as PostRecord } from '../../../../../lexicon/types/app/bsky/feed/post'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/feed/getPostThread'
import { ApiRes, findLocalPosts, getClock } from '../util/read-after-write'
import { ids } from '../../../../../lexicon/lexicons'

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
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getPostThread(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { uri, depth, parentHeight } = params

      const feedService = ctx.services.appView.feed(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const threadData = await getThreadData(
        feedService,
        uri,
        depth,
        parentHeight,
      )
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
  feedService: FeedService,
  uri: string,
  depth: number,
  parentHeight: number,
): Promise<PostThread | null> => {
  const [parents, children] = await Promise.all([
    feedService
      .selectPostQb()
      .innerJoin('post_hierarchy', 'post_hierarchy.ancestorUri', 'post.uri')
      .where('post_hierarchy.uri', '=', uri)
      .execute(),
    feedService
      .selectPostQb()
      .innerJoin('post_hierarchy', 'post_hierarchy.uri', 'post.uri')
      .where('post_hierarchy.uri', '!=', uri)
      .where('post_hierarchy.ancestorUri', '=', uri)
      .where('depth', '<=', depth)
      .orderBy('post.createdAt', 'desc')
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

const ensureReadAfterWrite = async (
  ctx: AppContext,
  requester: string,
  res: ApiRes<OutputSchema>,
): Promise<OutputSchema> => {
  const clock = getClock(res.headers)
  if (!clock) return res.data
  const notProcessed = await ctx.services
    .record(ctx.db)
    .getRecordsSinceClock(requester, clock, [ids.AppBskyFeedPost])
  const localPosts = findLocalPosts(notProcessed)
  const inThread = localPosts.filter((post) => {
    if (!post.reply?.root) return false
    if (post.reply?.root === res.data.thread.uri) return true
    return (res.data.thread.post as PostRecord).reply?.parent
  })
  if (inThread.length < 0) return res.data
  return {
    ...res.data,
    thread: insertIntoThreadReplies(res.data.thread, record),
  }
  const thread = res.data.thread

  // const localProf = notProcessed.at(-1) as ProfileRecord | undefined
  // if (!localProf) return res.data
  // const profiles = res.data.profiles.map((prof) => {
  //   if (prof.did !== requester) return prof
  //   return updateProfileDetailed(prof, localProf)
  // })
  // return {
  //   ...res.data,
  //   profiles,
  // }
}

const insertIntoThreadReplies = (
  view: ThreadViewPost,
  record: PostRecord,
): ThreadViewPost => {
  if (record.reply?.parent.uri === view.post.uri) {
    const postview = {} as any
    const replies = [postview, ...(view.replies ?? [])]
    replies.unshift(postview)
    return {
      ...view,
      replies,
    }
  }
  if (!view.replies) return view
  const replies = view.replies.map((reply) =>
    isThreadViewPost(reply) ? insertIntoThreadReplies(reply, record) : reply,
  )
  return {
    ...view,
    replies,
  }
}
