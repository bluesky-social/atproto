import { Server } from '../../../../lexicon'
import { FeedKeyset } from './util/feed'
import { GenericKeyset, paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../services/feed'
import { isPostView } from '../../../../lexicon/types/app/bsky/feed/defs'
import { NotEmptyArray } from '@atproto/common'
import { isViewRecord } from '../../../../lexicon/types/app/bsky/embed/record'
import { countAll, valuesList } from '../../../../db/util'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { GeneratorView } from '@atproto/api/src/client/types/app/bsky/feed/defs'

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
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { limit, cursor, query } = params
      const { ref } = db.dynamic
      const feedService = ctx.services.appView.feed(ctx.db)

      let inner = ctx.db.db
        .selectFrom('feed_generator')
        .select([
          'uri',
          'cid',
          ctx.db.db
            .selectFrom('like')
            .whereRef('like.subject', '=', ref('feed_generator.uri'))
            .select(countAll.as('count'))
            .as('likeCount'),
        ])

      if (query) {
        // like is case-insensitive is sqlite, and ilike is not supported
        const operator = ctx.db.dialect === 'pg' ? 'ilike' : 'like'
        inner = inner.where((qb) =>
          qb
            .where('feed_generator.displayName', operator, `%${query}%`)
            .orWhere('feed_generator.description', operator, `%${query}%`),
        )
      }

      let builder = ctx.db.db.selectFrom(inner.as('feed_gens')).selectAll()

      const keyset = new LikeCountKeyset(ref('likeCount'), ref('cid'))
      builder = paginate(builder, { limit, cursor, keyset, direction: 'desc' })

      const res = await builder.execute()

      const genInfos = await feedService.getFeedGeneratorInfos(
        res.map((feed) => feed.uri),
        requester,
      )

      const creators = Object.values(genInfos).map((gen) => gen.creator)
      const profiles = await feedService.getActorInfos(creators, requester)

      const genViews: GeneratorView[] = []
      for (const row of res) {
        const gen = genInfos[row.uri]
        if (!gen) continue
        const view = feedService.views.formatFeedGeneratorView(gen, profiles)
        genViews.push(view)
      }

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(res),
          feeds: genViews,
        },
      }
    },
  })
}

type Result = { likeCount: number; cid: string }
type LabeledResult = { primary: number; secondary: string }
export class LikeCountKeyset extends GenericKeyset<Result, LabeledResult> {
  labelResult(result: Result) {
    return {
      primary: result.likeCount,
      secondary: result.cid,
    }
  }
  labeledResultToCursor(labeled: LabeledResult) {
    return {
      primary: labeled.primary.toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: { primary: string; secondary: string }) {
    const likes = parseInt(cursor.primary, 10)
    if (isNaN(likes)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: likes,
      secondary: cursor.secondary,
    }
  }
}
