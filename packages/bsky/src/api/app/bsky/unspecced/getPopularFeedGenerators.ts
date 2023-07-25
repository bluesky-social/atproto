import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { countAll } from '../../../../db/util'
import { GenericKeyset, paginate } from '../../../../db/pagination'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { GeneratorView } from '../../../../lexicon/types/app/bsky/feed/defs'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor, query } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic
      const feedService = ctx.services.feed(ctx.db)

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
        inner = inner.where((qb) =>
          qb
            .where('feed_generator.displayName', 'ilike', `%${query}%`)
            .orWhere('feed_generator.description', 'ilike', `%${query}%`),
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
