import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { isNotFoundPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipelineNew,
  noRulesNew,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'

export default function (server: Server, ctx: AppContext) {
  const getPostThread = createPipelineNew(
    skeleton,
    hydration,
    noRulesNew, // handled in presentation: 3p block-violating replies are turned to #blockedPost, viewer blocks turned to #notFoundPost.
    presentation,
  )
  server.app.bsky.feed.getPostThread({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer = 'did' in auth.credentials ? auth.credentials.did : null

      const [result, repoRev] = await Promise.allSettled([
        getPostThread({ ...params, viewer }, ctx),
        ctx.hydrator.actor.getRepoRevSafe(viewer),
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

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const res = await ctx.dataplane.getThread({
    postUri: params.uri,
    above: params.parentHeight,
    below: params.depth,
  })
  return {
    anchor: params.uri,
    uris: res.uris,
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateThreadPosts(skeleton.uris, params.viewer)
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton, hydration } = inputs
  const thread = ctx.views.thread(skeleton.anchor, hydration, {
    height: params.parentHeight,
    depth: params.depth,
  })
  if (isNotFoundPost(thread)) {
    // @TODO technically this could be returned as a NotFoundPost based on lexicon
    throw new InvalidRequestError(`Post not found: ${params.uri}`, 'NotFound')
  }
  return { thread }
}

// @TODO tidy
// const composeThread = (
//   threadData: PostThread,
//   actors: ActorInfoMap,
//   state: HydrationState,
//   ctx: Context,
//   viewer: string | null,
// ) => {
//   const { feedService } = ctx
//   const { posts, threadgates, embeds, blocks, labels, lists } = state

//   const post = feedService.views.formatPostView(
//     threadData.post.postUri,
//     actors,
//     posts,
//     threadgates,
//     embeds,
//     labels,
//     lists,
//     viewer,
//   )

//   // replies that are invalid due to reply-gating:
//   // a. may appear as the anchor post, but without any parent or replies.
//   // b. may not appear anywhere else in the thread.
//   const isAnchorPost = state.threadData.post.uri === threadData.post.postUri
//   const info = posts[threadData.post.postUri]
//   // @TODO re-enable invalidReplyRoot check
//   // const badReply = !!info?.invalidReplyRoot || !!info?.violatesThreadGate
//   const badReply = !!info?.violatesThreadGate
//   const omitBadReply = !isAnchorPost && badReply

//   if (!post || blocks[post.uri]?.reply || omitBadReply) {
//     return {
//       $type: 'app.bsky.feed.defs#notFoundPost',
//       uri: threadData.post.postUri,
//       notFound: true,
//     }
//   }

//   if (post.author.viewer?.blocking || post.author.viewer?.blockedBy) {
//     return {
//       $type: 'app.bsky.feed.defs#blockedPost',
//       uri: threadData.post.postUri,
//       blocked: true,
//       author: {
//         did: post.author.did,
//         viewer: post.author.viewer
//           ? {
//               blockedBy: post.author.viewer?.blockedBy,
//               blocking: post.author.viewer?.blocking,
//             }
//           : undefined,
//       },
//     }
//   }

//   let parent
//   if (threadData.parent && !badReply) {
//     if (threadData.parent instanceof ParentNotFoundError) {
//       parent = {
//         $type: 'app.bsky.feed.defs#notFoundPost',
//         uri: threadData.parent.uri,
//         notFound: true,
//       }
//     } else {
//       parent = composeThread(threadData.parent, actors, state, ctx, viewer)
//     }
//   }

//   let replies: (ThreadViewPost | NotFoundPost | BlockedPost)[] | undefined
//   if (threadData.replies && !badReply) {
//     replies = threadData.replies.flatMap((reply) => {
//       const thread = composeThread(reply, actors, state, ctx, viewer)
//       // e.g. don't bother including #postNotFound reply placeholders for takedowns. either way matches api contract.
//       const skip = []
//       return isNotFoundPost(thread) ? skip : thread
//     })
//   }

//   return {
//     $type: 'app.bsky.feed.defs#threadViewPost',
//     post,
//     parent,
//     replies,
//   }
// }

// const getRelevantIds = (
//   thread: PostThread,
// ): { dids: Set<string>; uris: Set<string> } => {
//   const dids = new Set<string>()
//   const uris = new Set<string>()
//   if (thread.parent && !(thread.parent instanceof ParentNotFoundError)) {
//     const fromParent = getRelevantIds(thread.parent)
//     fromParent.dids.forEach((did) => dids.add(did))
//     fromParent.uris.forEach((uri) => uris.add(uri))
//   }
//   if (thread.replies) {
//     for (const reply of thread.replies) {
//       const fromChild = getRelevantIds(reply)
//       fromChild.dids.forEach((did) => dids.add(did))
//       fromChild.uris.forEach((uri) => uris.add(uri))
//     }
//   }
//   dids.add(thread.post.postAuthorDid)
//   uris.add(thread.post.postUri)
//   if (thread.post.replyRoot) {
//     // ensure root is included for checking interactions
//     uris.add(thread.post.replyRoot)
//     dids.add(new AtUri(thread.post.replyRoot).hostname)
//   }
//   return { dids, uris }
// }

// const getThreadData = async (
//   params: Params,
//   ctx: Context,
// ): Promise<PostThread | null> => {
//   const { db, feedService } = ctx
//   const { uri, depth, parentHeight } = params

//   const [parents, children] = await Promise.all([
//     getAncestorsAndSelfQb(db.db, { uri, parentHeight })
//       .selectFrom('ancestor')
//       .innerJoin(
//         feedService.selectPostQb().as('post'),
//         'post.uri',
//         'ancestor.uri',
//       )
//       .selectAll('post')
//       .execute(),
//     getDescendentsQb(db.db, { uri, depth })
//       .selectFrom('descendent')
//       .innerJoin(
//         feedService.selectPostQb().as('post'),
//         'post.uri',
//         'descendent.uri',
//       )
//       .selectAll('post')
//       .orderBy('sortAt', 'desc')
//       .execute(),
//   ])
//   // prevent self-referential loops
//   const includedPosts = new Set<string>([uri])
//   const parentsByUri = parents.reduce((acc, post) => {
//     return Object.assign(acc, { [post.uri]: post })
//   }, {} as Record<string, FeedRow>)
//   const childrenByParentUri = children.reduce((acc, child) => {
//     if (!child.replyParent) return acc
//     if (includedPosts.has(child.uri)) return acc
//     includedPosts.add(child.uri)
//     acc[child.replyParent] ??= []
//     acc[child.replyParent].push(child)
//     return acc
//   }, {} as Record<string, FeedRow[]>)
//   const post = parentsByUri[uri]
//   if (!post) return null
//   return {
//     post,
//     parent: post.replyParent
//       ? getParentData(
//           parentsByUri,
//           includedPosts,
//           post.replyParent,
//           parentHeight,
//         )
//       : undefined,
//     replies: getChildrenData(childrenByParentUri, uri, depth),
//   }
// }

// const getParentData = (
//   postsByUri: Record<string, FeedRow>,
//   includedPosts: Set<string>,
//   uri: string,
//   depth: number,
// ): PostThread | ParentNotFoundError | undefined => {
//   if (depth < 1) return undefined
//   if (includedPosts.has(uri)) return undefined
//   includedPosts.add(uri)
//   const post = postsByUri[uri]
//   if (!post) return new ParentNotFoundError(uri)
//   return {
//     post,
//     parent: post.replyParent
//       ? getParentData(postsByUri, includedPosts, post.replyParent, depth - 1)
//       : undefined,
//     replies: [],
//   }
// }

// const getChildrenData = (
//   childrenByParentUri: Record<string, FeedRow[]>,
//   uri: string,
//   depth: number,
// ): PostThread[] | undefined => {
//   if (depth === 0) return undefined
//   const children = childrenByParentUri[uri] ?? []
//   return children.map((row) => ({
//     post: row,
//     replies: getChildrenData(childrenByParentUri, row.postUri, depth - 1),
//   }))
// }

// class ParentNotFoundError extends Error {
//   constructor(public uri: string) {
//     super(`Parent not found: ${uri}`)
//   }
// }

// type PostThread = {
//   post: FeedRow
//   parent?: PostThread | ParentNotFoundError
//   replies?: PostThread[]
// }

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  anchor: string
  uris: string[]
}
