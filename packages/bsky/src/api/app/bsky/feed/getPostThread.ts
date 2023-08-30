import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  FeedRow,
  PostEmbedViews,
  PostBlocksMap,
} from '../../../../services/feed/types'
import { FeedService, PostInfoMap } from '../../../../services/feed'
import { LabelService, Labels } from '../../../../services/label'
import {
  BlockedPost,
  NotFoundPost,
  ThreadViewPost,
  isNotFoundPost,
} from '../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import {
  getAncestorsAndSelfQb,
  getDescendentsQb,
} from '../../../../services/util/post'
import { Database } from '../../../../db'
import { setRepoRev } from '../../../util'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.feed.getPostThread({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.did
      const db = ctx.db.getReplica('thread')
      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const labelService = ctx.services.label(db)

      const [result, repoRev] = await Promise.allSettled([
        getPostThread(
          { ...params, viewer },
          { db, actorService, feedService, labelService },
        ),
        actorService.getRepoRev(viewer),
      ])

      if (repoRev.status === 'fulfilled') {
        setRepoRev(res, repoRev.value)
      }
      if (result.status === 'rejected') {
        throw result.reason
      }

      return {
        encoding: 'application/json',
        body: result.value,
      }
    },
  })
}

const skeleton = async (params: Params, ctx: Context) => {
  const threadData = await getThreadData(params, ctx)
  if (!threadData) {
    throw new InvalidRequestError(`Post not found: ${params.uri}`, 'NotFound')
  }
  return { params, threadData }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService, feedService, labelService } = ctx
  const {
    threadData,
    params: { viewer },
  } = state
  const relevant = getRelevantIds(threadData)
  const [actors, posts, labels] = await Promise.all([
    actorService.views.profiles(Array.from(relevant.dids), viewer, {
      skipLabels: true,
    }),
    feedService.getPostInfos(Array.from(relevant.uris), viewer),
    labelService.getLabelsForSubjects([...relevant.uris, ...relevant.dids]),
  ])
  const blocks = await feedService.blocksForPosts(posts)
  const embeds = await feedService.embedsForPosts(posts, blocks, viewer)
  return {
    ...state,
    actors,
    posts,
    labels,
    blocks,
    embeds,
  }
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { params } = state
  const thread = composeThread(state.threadData, state, ctx)
  if (isNotFoundPost(thread)) {
    // @TODO technically this could be returned as a NotFoundPost based on lexicon
    throw new InvalidRequestError(`Post not found: ${params.uri}`, 'NotFound')
  }
  return { thread }
}

const composeThread = (
  threadData: PostThread,
  state: HydrationState,
  ctx: Context,
) => {
  const { feedService } = ctx
  const { actors, posts, embeds, blocks, labels } = state

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

  let parent
  if (threadData.parent) {
    if (threadData.parent instanceof ParentNotFoundError) {
      parent = {
        $type: 'app.bsky.feed.defs#notFoundPost',
        uri: threadData.parent.uri,
        notFound: true,
      }
    } else {
      parent = composeThread(threadData.parent, state, ctx)
    }
  }

  let replies: (ThreadViewPost | NotFoundPost | BlockedPost)[] | undefined
  if (threadData.replies) {
    replies = threadData.replies.flatMap((reply) => {
      const thread = composeThread(reply, state, ctx)
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
  params: Params,
  ctx: Context,
): Promise<PostThread | null> => {
  const { db, feedService } = ctx
  const { uri, depth, parentHeight } = params

  const [parents, children] = await Promise.all([
    getAncestorsAndSelfQb(db.db, { uri, parentHeight })
      .selectFrom('ancestor')
      .innerJoin(
        feedService.selectPostQb().as('post'),
        'post.uri',
        'ancestor.uri',
      )
      .selectAll('post')
      .execute(),
    getDescendentsQb(db.db, { uri, depth })
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
  if (depth < 1) return undefined
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

type PostThread = {
  post: FeedRow
  parent?: PostThread | ParentNotFoundError
  replies?: PostThread[]
}

type Context = {
  db: Database
  actorService: ActorService
  feedService: FeedService
  labelService: LabelService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  threadData: PostThread
}

type HydrationState = SkeletonState & {
  threadData: PostThread
  posts: PostInfoMap
  actors: ActorInfoMap
  embeds: PostEmbedViews
  blocks: PostBlocksMap
  labels: Labels
}
