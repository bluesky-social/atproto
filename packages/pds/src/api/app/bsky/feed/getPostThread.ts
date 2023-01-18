import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  ActorViewMap,
  FeedEmbeds,
  FeedRow,
  FeedService,
  PostInfoMap,
} from '../../../../services/feed'

export type PostThread = {
  post: FeedRow
  parent?: PostThread | ParentNotFoundError
  replies?: PostThread[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { uri, depth = 6 } = params
      const requester = auth.credentials.did

      const feedService = ctx.services.feed(ctx.db)

      const threadData = await getThreadData(feedService, uri, depth)
      if (!threadData) {
        throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      }
      const relevant = getRelevantIds(threadData)
      const [actors, posts, embeds] = await Promise.all([
        feedService.getActorViews(Array.from(relevant.dids), requester),
        feedService.getPostViews(Array.from(relevant.uris), requester),
        feedService.embedsForPosts(Array.from(relevant.uris)),
      ])

      const thread = composeThread(
        threadData,
        feedService,
        posts,
        actors,
        embeds,
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
) => {
  const post = feedService.formatPostView(
    threadData.post.postUri,
    actors,
    posts,
    embeds,
  )

  let parent
  if (threadData.parent) {
    if (threadData.parent instanceof ParentNotFoundError) {
      parent = {
        $type: 'app.bsky.feed.getPostThread#notFoundPost',
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
      )
    }
  }

  let replies
  if (threadData.replies) {
    replies = threadData.replies.map((reply) =>
      composeThread(reply, feedService, posts, actors, embeds),
    )
  }

  return {
    $type: 'app.bsky.feed.getPostThread#threadViewPost',
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
  dids.add(thread.post.authorDid)
  uris.add(thread.post.postUri)
  return { dids, uris }
}

const getThreadData = async (
  feedService: FeedService,
  uri: string,
  depth: number,
): Promise<PostThread | null> => {
  const post = await feedService
    .selectPostQb()
    .where('post.uri', '=', uri)
    .executeTakeFirst()
  if (!post) return null
  return {
    post,
    parent: post.replyParent
      ? await getParentData(feedService, post.replyParent)
      : undefined,
    replies: await getChildrenData(feedService, uri, depth),
  }
}

const getParentData = async (
  feedService: FeedService,
  uri: string,
): Promise<PostThread | ParentNotFoundError> => {
  const post = await feedService
    .selectPostQb()
    .where('post.uri', '=', uri)
    .executeTakeFirst()
  if (!post) return new ParentNotFoundError(uri)
  return {
    post,
    parent: post.replyParent
      ? await getParentData(feedService, post.replyParent)
      : undefined,
    replies: [],
  }
}

const getChildrenData = async (
  feedService: FeedService,
  uri: string,
  depth: number,
): Promise<PostThread[] | undefined> => {
  if (depth === 0) return undefined
  const children = await feedService
    .selectPostQb()
    .where('post.replyParent', '=', uri)
    .orderBy('post.createdAt', 'desc')
    .execute()
  return Promise.all(
    children.map(async (row) => ({
      post: row,
      replies: await getChildrenData(feedService, row.postUri, depth - 1),
    })),
  )
}

class ParentNotFoundError extends Error {
  constructor(public uri: string) {
    super(`Parent not found: ${uri}`)
  }
}
