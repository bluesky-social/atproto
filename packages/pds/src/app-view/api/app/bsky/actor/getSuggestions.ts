import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../../db/pagination'
import { notSoftDeletedClause } from '../../../../../db/util'
import { Server } from '../../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      let { limit } = params
      const { cursor } = params
      const requester = auth.credentials.did
      limit = Math.min(limit ?? 25, 100)

      const db = ctx.db.db
      const { services } = ctx
      const { ref } = db.dynamic

      const actorService = ctx.services.appView.actor(ctx.db)

      let suggestionsQb = db
        .selectFrom('user_account')
        .innerJoin('did_handle', 'user_account.did', 'did_handle.did')
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .innerJoin('profile_agg', 'profile_agg.did', 'did_handle.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .where('did_handle.did', '!=', requester)
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did')),
        )
        .whereNotExists(
          actorService.blockQb(requester, [ref('did_handle.did')]),
        )
        .selectAll('did_handle')
        .select('profile_agg.postsCount as postsCount')

      const keyset = new PostCountDidKeyset(
        ref('profile_agg.postsCount'),
        ref('did_handle.did'),
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
          actors: await services.appView
            .actor(ctx.db)
            .views.profile(suggestionsRes, requester),
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
