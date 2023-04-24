import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  ActorViewMap,
  FeedEmbeds,
  FeedRow,
  PostInfoMap,
} from '../../../../services/types'
import { FeedService } from '../../../../services/feed'
import { authOptionalVerifier } from '../../../auth'
import { Labels } from '../../../../services/label'

export type PostThread = {
  post: FeedRow
  parent?: PostThread | ParentNotFoundError
  replies?: PostThread[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, depth = 6 } = params
      const requester = auth.credentials.did

      const feedService = ctx.services.feed(ctx.db)
      const labelService = ctx.services.label(ctx.db)

      const threadData = await getThreadData(feedService, uri, depth)
      if (!threadData) {
        throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      }
      const relevant = getRelevantIds(threadData)
      const [actors, posts, embeds, labels] = await Promise.all([
        feedService.getActorViews(Array.from(relevant.dids), requester),
        feedService.getPostViews(Array.from(relevant.uris), requester),
        feedService.embedsForPosts(Array.from(relevant.uris), requester),
        labelService.getLabelsForSubjects(Array.from(relevant.uris)),
      ])

      const thread = composeThread(
        threadData,
        feedService,
        posts,
        actors,
        embeds,
        labels,
      )
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
  actors: ActorViewMap,
  embeds: FeedEmbeds,
  labels: Labels,
) => {
  const post = feedService.formatPostView(
    threadData.post.postUri,
    actors,
    posts,
    embeds,
    labels,
  )

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
        labels,
      )
    }
  }

  let replies
  if (threadData.replies) {
    replies = threadData.replies.map((reply) =>
      composeThread(reply, feedService, posts, actors, embeds, labels),
    )
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
      ? getParentData(parentsByUri, post.replyParent)
      : undefined,
    replies: getChildrenData(childrenByParentUri, uri, depth),
  }
}

const getParentData = (
  postsByUri: Record<string, FeedRow>,
  uri: string,
): PostThread | ParentNotFoundError => {
  const post = postsByUri[uri]
  if (!post) return new ParentNotFoundError(uri)
  return {
    post,
    parent: post.replyParent
      ? getParentData(postsByUri, post.replyParent)
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
