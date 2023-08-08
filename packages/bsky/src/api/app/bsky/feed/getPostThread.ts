import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  FeedRow,
  ActorInfoMap,
  PostEmbedViews,
  PostBlocksMap,
} from '../../../../services/feed/types'
import { FeedService, PostInfoMap } from '../../../../services/feed'
import { Labels } from '../../../../services/label'
import {
  BlockedPost,
  NotFoundPost,
  ThreadViewPost,
  isNotFoundPost,
} from '../../../../lexicon/types/app/bsky/feed/defs'
import {
  getAncestorsAndSelfQb,
  getDescendentsQb,
} from '../../../../services/util/post'

export type PostThread = {
  post: FeedRow
  parent?: PostThread | ParentNotFoundError
  replies?: PostThread[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, depth, parentHeight } = params
      const requester = auth.credentials.did

      const feedService = ctx.services.feed(ctx.db)
      const labelService = ctx.services.label(ctx.db)

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
) => {
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

  let parent
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
  const feedService = ctx.services.feed(ctx.db)
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
