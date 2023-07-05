import { Server } from '../../../../lexicon'
import { FeedKeyset } from './util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../services/feed'
import { isPostView } from '../../../../lexicon/types/app/bsky/feed/defs'
import { NotEmptyArray } from '@atproto/common'
import { isViewRecord } from '../../../../lexicon/types/app/bsky/embed/record'
import { countAll, valuesList } from '../../../../db/util'

const NO_WHATS_HOT_LABELS: NotEmptyArray<string> = [
  '!no-promote',
  'corpse',
  'self-harm',
]

const NSFW_LABELS = ['porn', 'sexual', 'nudity', 'underwear']

// @NOTE currently relies on the hot-classic feed being configured on the pds
// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const hotClassicUri = Object.keys(ctx.algos).find((uri) =>
          uri.endsWith('/hot-classic'),
        )
        if (!hotClassicUri) {
          return {
            encoding: 'application/json',
            body: { feed: [] },
          }
        }
        const { data: feed } =
          await ctx.appviewAgent.api.app.bsky.feed.getFeedGenerator(
            { feed: hotClassicUri },
            await ctx.serviceAuthHeaders(requester),
          )
        const res = await ctx.appviewAgent.api.app.bsky.feed.getFeed(
          { ...params, feed: hotClassicUri },
          await ctx.serviceAuthHeaders(requester, feed.view.did),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { limit, cursor, includeNsfw } = params
      const db = ctx.db.db
      const { ref } = db.dynamic

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      const labelsToFilter = includeNsfw
        ? NO_WHATS_HOT_LABELS
        : [...NO_WHATS_HOT_LABELS, ...NSFW_LABELS]

      const postsQb = feedService
        .selectPostQb()
        .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
        .where('post_agg.likeCount', '>=', 12)
        .where('post.replyParent', 'is', null)
        .whereNotExists((qb) =>
          qb
            .selectFrom('label')
            .selectAll()
            .whereRef('val', 'in', valuesList(labelsToFilter))
            .where('neg', '=', 0)
            .where((clause) =>
              clause
                .whereRef('label.uri', '=', ref('post.creator'))
                .orWhereRef('label.uri', '=', ref('post.uri')),
            ),
        )
        .where((qb) =>
          accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
        )
        .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))

      const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

      let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
      feedQb = paginate(feedQb, { limit, cursor, keyset })

      const feedItems: FeedRow[] = await feedQb.execute()
      const feed = await feedService.hydrateFeed(feedItems, requester)

      // filter out any quote post where the internal post has a filtered label
      const noLabeledQuotePosts = feed.filter((post) => {
        const quoteView = post.post.embed?.record
        if (!quoteView || !isViewRecord(quoteView)) return true
        for (const label of quoteView.labels || []) {
          if (labelsToFilter.includes(label.val)) return false
        }
        return true
      })

      // remove record embeds in our response
      const noRecordEmbeds = noLabeledQuotePosts.map((post) => {
        delete post.post.record['embed']
        if (post.reply) {
          if (isPostView(post.reply.parent)) {
            delete post.reply.parent.record['embed']
          }
          if (isPostView(post.reply.root)) {
            delete post.reply.root.record['embed']
          }
        }
        return post
      })

      return {
        encoding: 'application/json',
        body: {
          feed: noRecordEmbeds,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })

  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic
      const feedService = ctx.services.appView.feed(ctx.db)

      const mostPopularFeeds = await ctx.db.db
        .selectFrom('feed_generator')
        .select([
          'uri',
          ctx.db.db
            .selectFrom('like')
            .whereRef('like.subject', '=', ref('feed_generator.uri'))
            .select(countAll.as('count'))
            .as('likeCount'),
        ])
        .orderBy('likeCount', 'desc')
        .orderBy('cid', 'desc')
        .limit(50)
        .execute()

      const genViews = await feedService.getFeedGeneratorInfos(
        mostPopularFeeds.map((feed) => feed.uri),
        requester,
      )

      const genList = Object.values(genViews)
      const creators = genList.map((gen) => gen.creator)
      const profiles = await feedService.getActorInfos(creators, requester)

      const feedViews = genList.map((gen) =>
        feedService.views.formatFeedGeneratorView(gen, profiles),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews.sort((feedA, feedB) => {
            const likeA = feedA.likeCount ?? 0
            const likeB = feedB.likeCount ?? 0
            const likeDiff = likeB - likeA
            if (likeDiff !== 0) return likeDiff
            return feedB.cid.localeCompare(feedA.cid)
          }),
        },
      }
    },
  })
}
