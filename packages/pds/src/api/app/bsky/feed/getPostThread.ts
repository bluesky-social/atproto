import { InvalidRequestError } from '@atproto/xrpc-server'
import * as common from '@atproto/common'
import { Server } from '../../../../lexicon'
import * as GetPostThread from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import DatabaseSchema from '../../../../db/database-schema'
import { countAll } from '../../../../db/util'
import { getDeclaration } from '../util'
import { ImageUriBuilder } from '../../../../image/uri'
import AppContext from '../../../../context'
import {
  ActorViewMap,
  FeedEmbeds,
  FeedRow,
  FeedService,
  PostInfoMap,
} from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      // const { uri, depth = 6 } = params
      // const requester = auth.credentials.did
      // const { db, imgUriBuilder } = ctx

      // const feedService = ctx.services.feed(ctx.db, ctx.imgUriBuilder)

      // const relevantPosts = await getReleventPosts(feedService, uri, depth)
      // const actorDids = new Set<string>()
      // const postUris = new Set<string>()
      // for (const row of relevantPosts) {
      //   actorDids.add(row.originatorDid)
      //   actorDids.add(row.authorDid)
      //   postUris.add(row.postUri)
      // }

      // const [actors, posts, embeds] = await Promise.all([
      //   feedService.getActorViews(Array.from(actorDids)),
      //   feedService.getPostViews(Array.from(postUris), requester),
      //   feedService.embedsForPosts(Array.from(postUris)),
      // ])

      // const post = feedService.formatPostView(uri, actors, posts, embeds)
      // if (!post) {
      //   throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      // }
      // const thread = {
      //   post,
      // }

      // const post = feedService
      //   .selectPostQb()
      //   .where('post.uri', '=', uri)
      //   .executeTakeFirst()

      // const queryRes = await postInfoBuilder(db.db, requester)
      //   .where('post.uri', '=', uri)
      //   .executeTakeFirst()

      // if (!queryRes) {
      //   throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      // }

      // const embeds = await embedsForPosts(db.db, imgUriBuilder, [queryRes.uri])
      // const thread = rowToPost(imgUriBuilder, embeds, queryRes)
      // if (depth > 0) {
      //   thread.replies = await getReplies(
      //     db.db,
      //     imgUriBuilder,
      //     thread,
      //     depth - 1,
      //     requester,
      //   )
      // }
      // if (queryRes.parent !== null) {
      //   thread.parent = await getAncestors(
      //     db.db,
      //     imgUriBuilder,
      //     queryRes.parent,
      //     requester,
      //   )
      // }

      // return {
      //   encoding: 'application/json',
      //   body: { thread },
      // }
      return {} as any
    },
  })
}

// const composeThread = (
//   feedService: FeedService,
//   posts: PostInfoMap,
//   actors: ActorViewMap,
//   embeds: FeedEmbeds,
//   uri: string,
// ) => {
//   const post = feedService.formatPostView(uri, actors, posts, embeds)
//   if (!post) return null
//   return {
//     post,
//     parent: composeParent(feedService),
//     replies: composeReplies(feedService, posts, actors, embeds),
//   }
// }

// const composeAncestors = (
//   feedService: FeedService,
//   posts: PostInfoMap,
//   actors: ActorViewMap,
//   embeds: FeedEmbeds,
//   parentUri?: string,
// ) => {
//   if (!parentUri) return undefined
//   const post = feedService.formatPostView(parentUri, actors, posts, embeds)
//   if (!post) {
//     return {
//       $type: 'app.bsky.feed.getPostThread#notFoundPost',
//       uri: parentUri,
//       notFound: true,
//     }
//   }
//   return {
//     post,
//     parent: composeAncestors(feedService, posts, actors, embeds, post.)
//   }
// }

// const getReleventPosts = async (
//   feedService: FeedService,
//   uri: string,
//   depth: number,
// ): Promise<FeedRow[]> => {
//   const post = await feedService
//     .selectPostQb()
//     .where('post.uri', '=', uri)
//     .executeTakeFirst()
//   if (!post) return []
//   const [ancestors, children] = await Promise.all([
//     getReleventAncestors(feedService, post.replyParent || undefined),
//     getReleventChildren(feedService, [post.postUri], depth),
//   ])
//   return [...ancestors, ...children]
// }

// const getReleventAncestors = async (
//   feedService: FeedService,
//   parentUri?: string,
// ): Promise<FeedRow[]> => {
//   if (!parentUri) return []
//   const parent = await feedService
//     .selectPostQb()
//     .where('post.uri', '=', parentUri)
//     .executeTakeFirst()
//   if (!parent) return []
//   const ancestors = await getReleventAncestors(
//     feedService,
//     parent?.replyParent || undefined,
//   )
//   return [parent, ...ancestors]
// }

// const getReleventChildren = async (
//   feedService: FeedService,
//   uris: string[],
//   depth: number,
// ): Promise<FeedRow[]> => {
//   if (depth === 0 || uris.length == 0) return []
//   const children = await feedService
//     .selectPostQb()
//     .where('post.replyParent', 'in', uris)
//     .execute()
//   const childUris = children.map((row) => row.postUri)
//   return [
//     ...children,
//     ...(await getReleventChildren(feedService, childUris, depth - 1)),
//   ]
// }

// const getAncestors = async (
//   db: DatabaseSchema,
//   imgUriBuilder: ImageUriBuilder,
//   parentUri: string,
//   requester: string,
// ): Promise<GetPostThread.Post | GetPostThread.NotFoundPost> => {
//   const parentRes = await postInfoBuilder(db, requester)
//     .where('post.uri', '=', parentUri)
//     .executeTakeFirst()
//   if (!parentRes) {
//     return {
//       $type: 'app.bsky.feed.getPostThread#notFoundPost',
//       uri: parentUri,
//       notFound: true,
//     }
//   }
//   const embeds = await embedsForPosts(db, imgUriBuilder, [parentRes.uri])
//   const parentObj = rowToPost(imgUriBuilder, embeds, parentRes)
//   if (parentRes.parent !== null) {
//     parentObj.parent = await getAncestors(
//       db,
//       imgUriBuilder,
//       parentRes.parent,
//       requester,
//     )
//   }
//   return parentObj
// }

// const getReplies = async (
//   db: DatabaseSchema,
//   imgUriBuilder: ImageUriBuilder,
//   parent: GetPostThread.Post,
//   depth: number,
//   requester: string,
// ): Promise<GetPostThread.Post[]> => {
//   const res = await postInfoBuilder(db, requester)
//     .where('post.replyParent', '=', parent.uri)
//     .orderBy('post.createdAt', 'desc')
//     .execute()
//   const postUris = res.map((row) => row.uri)
//   const embeds = await embedsForPosts(db, imgUriBuilder, postUris)
//   const got = await Promise.all(
//     res.map(async (row) => {
//       const post = rowToPost(imgUriBuilder, embeds, row, parent)
//       if (depth > 0) {
//         post.replies = await getReplies(
//           db,
//           imgUriBuilder,
//           post,
//           depth - 1,
//           requester,
//         )
//       }
//       return post
//     }),
//   )
//   return got
// }

// // selects all the needed info about a post, just need to supply the `where` clause
// // @TODO break this query up, share parts with home/author feeds
// const postInfoBuilder = (db: DatabaseSchema, requester: string) => {
//   const { ref } = db.dynamic
//   return db
//     .selectFrom('post')
//     .innerJoin('ipld_block', 'ipld_block.cid', 'post.cid')
//     .innerJoin('did_handle as author', 'author.did', 'post.creator')
//     .leftJoin(
//       'profile as author_profile',
//       'author.did',
//       'author_profile.creator',
//     )
//     .select([
//       'post.uri as uri',
//       'post.cid as cid',
//       'post.replyParent as parent',
//       'author.did as authorDid',
//       'author.declarationCid as authorDeclarationCid',
//       'author.actorType as authorActorType',
//       'author.handle as authorHandle',
//       'author_profile.displayName as authorDisplayName',
//       'author_profile.avatarCid as authorAvatarCid',
//       'ipld_block.content as recordBytes',
//       'ipld_block.indexedAt as indexedAt',
//       db
//         .selectFrom('vote')
//         .whereRef('subject', '=', ref('post.uri'))
//         .where('direction', '=', 'up')
//         .select(countAll.as('count'))
//         .as('upvoteCount'),
//       db
//         .selectFrom('vote')
//         .whereRef('subject', '=', ref('post.uri'))
//         .where('direction', '=', 'down')
//         .select(countAll.as('count'))
//         .as('downvoteCount'),
//       db
//         .selectFrom('repost')
//         .select(countAll.as('count'))
//         .whereRef('subject', '=', ref('post.uri'))
//         .as('repostCount'),
//       db
//         .selectFrom('post as reply')
//         .select(countAll.as('count'))
//         .whereRef('replyParent', '=', ref('post.uri'))
//         .as('replyCount'),
//       db
//         .selectFrom('repost')
//         .select('uri')
//         .where('creator', '=', requester)
//         .whereRef('subject', '=', ref('post.uri'))
//         .as('requesterRepost'),
//       db
//         .selectFrom('vote')
//         .where('creator', '=', requester)
//         .whereRef('subject', '=', ref('post.uri'))
//         .where('direction', '=', 'up')
//         .select('uri')
//         .as('requesterUpvote'),
//       db
//         .selectFrom('vote')
//         .where('creator', '=', requester)
//         .whereRef('subject', '=', ref('post.uri'))
//         .where('direction', '=', 'down')
//         .select('uri')
//         .as('requesterDownvote'),
//     ])
// }

// // converts the raw SQL output to a Post object
// // unfortunately not type-checked yet, so change with caution!
// const rowToPost = (
//   imgUriBuilder: ImageUriBuilder,
//   embeds: FeedEmbeds,
//   row: any,
//   parent?: GetPostThread.Post,
// ): GetPostThread.Post => {
//   return {
//     $type: 'app.bsky.feed.getPostThread#post',
//     uri: row.uri,
//     cid: row.cid,
//     author: {
//       did: row.authorDid,
//       declaration: getDeclaration('author', row),
//       handle: row.authorHandle,
//       displayName: row.authorDisplayName || undefined,
//       avatar: row.authorAvatarCid
//         ? imgUriBuilder.getCommonSignedUri('avatar', row.authorAvatarCid)
//         : undefined,
//     },
//     record: common.ipldBytesToRecord(row.recordBytes),
//     embed: embeds[row.uri],
//     parent: parent ? { ...parent } : undefined,
//     replyCount: row.replyCount || 0,
//     upvoteCount: row.upvoteCount || 0,
//     downvoteCount: row.downvoteCount || 0,
//     repostCount: row.repostCount || 0,
//     indexedAt: row.indexedAt,
//     myState: {
//       repost: row.requesterRepost || undefined,
//       upvote: row.requesterUpvote || undefined,
//       downvote: row.requesterDownvote || undefined,
//     },
//   }
// }
