import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../db/pagination'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import { Server } from '../../../../lexicon'

// @TODO switch to use profile_agg once that table is being materialized (see: pds)
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      let { limit } = params
      const { cursor } = params
      const viewer = auth.credentials.did
      limit = Math.min(limit ?? 25, 100)

      const actorService = ctx.services.actor(ctx.db)
      const graphService = ctx.services.graph(ctx.db)

      const db = ctx.db.db
      const { ref } = db.dynamic
      const suggestionsQb = db
        .selectFrom('actor')
        .where(notSoftDeletedClause(ref('actor')))
        .where('actor.did', '!=', viewer ?? '')
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', viewer ?? '')
            .whereRef('subjectDid', '=', ref('actor.did')),
        )
        .whereNotExists(graphService.blockQb(viewer, [ref('actor.did')]))
        .selectAll()
        .select(
          db
            .selectFrom('post')
            .whereRef('creator', '=', ref('actor.did'))
            .select(countAll.as('count'))
            .as('postCount'),
        )

      // PG doesn't let you do WHEREs on aliases, so we wrap it in a subquery
      let suggestionsReq = db
        .selectFrom(suggestionsQb.as('suggestions'))
        .selectAll()

      const keyset = new PostCountDidKeyset(ref('postCount'), ref('did'))
      suggestionsReq = paginate(suggestionsReq, {
        limit,
        cursor,
        keyset,
        direction: 'desc',
      })

      const suggestionsRes = await suggestionsReq.execute()

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(suggestionsRes),
          actors: await actorService.views.profile(suggestionsRes, viewer),
        },
      }
    },
  })
}

type PostCountDidResult = { postCount: number; did: string }
type PostCountDidLabeledResult = { primary: number; secondary: string }

export class PostCountDidKeyset extends GenericKeyset<
  PostCountDidResult,
  PostCountDidLabeledResult
> {
  labelResult(result: PostCountDidResult): PostCountDidLabeledResult {
    return { primary: result.postCount, secondary: result.did }
  }
  labeledResultToCursor(labeled: PostCountDidLabeledResult) {
    return {
      primary: labeled.primary.toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const parsed = parseInt(cursor.primary)
    if (isNaN(parsed)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: parsed,
      secondary: cursor.secondary,
    }
  }
}
