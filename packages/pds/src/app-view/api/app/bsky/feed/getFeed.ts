import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { FeedService } from '../../../../services/feed'
import { getFeedGen } from '@atproto/did-resolver'
import { AtUri, AtpAgent } from '@atproto/api'
import { createServiceAuthHeaders } from '../../../../../auth'
import { LabelService } from '../../../../services/label'
import {
  FeedViewPost,
  SkeletonFeedPost,
  isSkeletonReasonRepost,
} from '../../../../../lexicon/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const db = ctx.db.db
      const requester = auth.credentials.did

      let feedDid: string
      if (feed.startsWith('did:')) {
        feedDid = feed
      } else {
        const found = await db
          .selectFrom('did_handle')
          .where('handle', '=', feed)
          .select('did')
          .executeTakeFirst()
        if (!found) {
          throw new InvalidRequestError(
            `could not resolve feed handle: ${feed}`,
          )
        }
        feedDid = found.did
      }
      const resolved = await ctx.didResolver.resolveDid(feedDid)
      if (!resolved) {
        throw new InvalidRequestError(
          `could not resolve did document: ${feedDid}`,
        )
      }
      const fgEndpoint = await getFeedGen(resolved)
      if (!fgEndpoint) {
        throw new InvalidRequestError(`not a valid feed generator: ${feedDid}`)
      }
      const agent = new AtpAgent({ service: fgEndpoint })
      const headers = await createServiceAuthHeaders(
        requester,
        ctx.repoSigningKey,
      )
      const res = await agent.api.app.bsky.feed.getFeedSkeleton(params, headers)
      const hydrated = await hydrateFeed(
        ctx.services.appView.feed(ctx.db),
        ctx.services.appView.label(ctx.db),
        res.data.feed,
        requester,
      )
      return {
        encoding: 'application/json',
        body: {
          feed: hydrated,
          cursor: res.data.cursor,
        },
      }
    },
  })
}

// @TODO add in mutes & blocks
export const hydrateFeed = async (
  feedService: FeedService,
  labelService: LabelService,
  items: SkeletonFeedPost[],
  requester: string,
): Promise<FeedViewPost[]> => {
  const actorDids = new Set<string>()
  const postUris = new Set<string>()
  for (const item of items) {
    actorDids.add(new AtUri(item.post).hostname)
    postUris.add(item.post)
    if (item.reason && isSkeletonReasonRepost(item.reason)) {
      actorDids.add(item.reason.by)
    }
    if (item.replyTo) {
      postUris.add(item.replyTo.parent)
      postUris.add(item.replyTo.root)
      actorDids.add(new AtUri(item.replyTo.parent).hostname)
      actorDids.add(new AtUri(item.replyTo.root).hostname)
    }
  }
  const [actors, posts, embeds, labels] = await Promise.all([
    feedService.getActorViews(Array.from(actorDids), requester),
    feedService.getPostViews(Array.from(postUris), requester),
    feedService.embedsForPosts(Array.from(postUris), requester),
    labelService.getLabelsForSubjects(Array.from(postUris)),
  ])

  const feed: FeedViewPost[] = []
  for (const item of items) {
    const post = feedService.formatPostView(
      item.post,
      actors,
      posts,
      embeds,
      labels,
    )
    // @TODO should we be doing #postNotFound here as well?
    if (!post) continue
    const postView = { post }
    if (item.reason && isSkeletonReasonRepost(item.reason)) {
      const originator = actors[item.reason.by]
      if (originator) {
        postView['reason'] = {
          $type: 'app.bsky.feed.defs#reasonRepost',
          by: originator,
          indexedAt: item.reason.indexedAt,
        }
      }
    }
    if (item.replyTo) {
      const replyParent = feedService.formatPostView(
        item.replyTo.parent,
        actors,
        posts,
        embeds,
        labels,
      )
      const replyRoot = feedService.formatPostView(
        item.replyTo.root,
        actors,
        posts,
        embeds,
        labels,
      )
      // @TODO consider supporting #postNotFound here
      if (replyRoot && replyParent) {
        postView['reply'] = {
          root: replyRoot,
          parent: replyParent,
        }
      }
    }
    return feed
  }
  return feed
}
