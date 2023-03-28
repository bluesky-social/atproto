import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../../db/pagination'
import { countAll, notSoftDeletedClause } from '../../../../../db/util'
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

      const suggestionsQb = db
        .selectFrom('user_account')
        .innerJoin('did_handle', 'user_account.did', 'did_handle.did')
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .where('did_handle.did', '!=', requester)
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did')),
        )
        .selectAll('did_handle')
        .select(
          db
            .selectFrom('post')
            .whereRef('creator', '=', ref('did_handle.did'))
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
          actors: await services.appView
            .actor(ctx.db)
            .views.profile(suggestionsRes, requester),
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
