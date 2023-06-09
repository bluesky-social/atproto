import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../db/pagination'
import { notSoftDeletedClause } from '../../../../db/util'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      let { limit } = params
      const { cursor } = params
      const viewer = auth.credentials.did
      limit = Math.min(limit ?? 25, 100)

      const db = ctx.db.db
      const { services } = ctx
      const { ref } = db.dynamic

      let suggestionsQb = db
        .selectFrom('actor')
        .where(notSoftDeletedClause(ref('actor')))
        .innerJoin('profile_agg', 'profile_agg.did', 'actor.did')
        .where('actor.did', '!=', viewer ?? '')
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', viewer ?? '')
            .whereRef('subjectDid', '=', ref('actor.did')),
        )
        .selectAll()
        .select('profile_agg.postsCount as postsCount')

      const keyset = new PostCountDidKeyset(
        ref('profile_agg.postsCount'),
        ref('actor.did'),
      )
      suggestionsQb = paginate(suggestionsQb, {
        limit,
        cursor,
        keyset,
        direction: 'desc',
      })

      const suggestionsRes = await suggestionsQb.execute()

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(suggestionsRes),
          actors: await services
            .actor(ctx.db)
            .views.profile(suggestionsRes, viewer),
        },
      }
    },
  })
}

type PostCountDidResult = { postsCount: number; did: string }
type PostCountDidLabeledResult = { primary: number; secondary: string }

export class PostCountDidKeyset extends GenericKeyset<
  PostCountDidResult,
  PostCountDidLabeledResult
> {
  labelResult(result: PostCountDidResult): PostCountDidLabeledResult {
    return { primary: result.postsCount, secondary: result.did }
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
