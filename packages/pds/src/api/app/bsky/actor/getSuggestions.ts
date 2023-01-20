import AppContext from '../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../db/pagination'
import { countAll, notSoftDeletedClause } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { getDeclarationSimple } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      let { limit } = params
      const { cursor } = params
      const requester = auth.credentials.did
      limit = Math.min(limit ?? 25, 100)

      const db = ctx.db.db
      const { ref } = db.dynamic

      let suggestionsReq = db
        .selectFrom('user')
        .innerJoin('did_handle', 'user.handle', 'did_handle.handle')
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .select([
          'did_handle.did as did',
          'did_handle.handle as handle',
          'did_handle.actorType as actorType',
          'did_handle.declarationCid as declarationCid',
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          'profile.avatarCid as avatarCid',
          'profile.indexedAt as indexedAt',
          'user.createdAt as createdAt',
          db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollow'),
          db
            .selectFrom('post')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('orderCount'),
        ])

      const keyset = new CountDidKeyset(
        ref('orderCount'),
        ref('did_handle.did'),
      )
      suggestionsReq = paginate(suggestionsReq, {
        limit,
        before: cursor,
        keyset,
        direction: 'desc',
      })

      const suggestionsRes = await suggestionsReq.execute()

      const actors = suggestionsRes.map((result) => ({
        did: result.did,
        handle: result.handle,
        declaration: getDeclarationSimple(result),
        displayName: result.displayName ?? undefined,
        description: result.description ?? undefined,
        avatar: result.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', result.avatarCid)
          : undefined,
        indexedAt: result.indexedAt ?? undefined,
        myState: {
          follow: result.requesterFollow || undefined,
        },
      }))

      return {
        encoding: 'application/json',
        body: {
          actors,
          cursor: keyset.packFromResult(suggestionsRes),
        },
      }
    },
  })
}

type CountDidResult = { orderCount: number; did: string }
type CountDidLabeledResult = { primary: number; secondary: string }

export class CountDidKeyset extends GenericKeyset<
  CountDidResult,
  CountDidLabeledResult
> {
  labelResult(result: CountDidResult): CountDidLabeledResult {
    return { primary: result.orderCount, secondary: result.did }
  }
  labeledResultToCursor(labeled: CountDidLabeledResult) {
    return {
      primary: labeled.primary.toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    return {
      primary: parseInt(cursor.primary),
      secondary: cursor.secondary,
    }
  }
}
