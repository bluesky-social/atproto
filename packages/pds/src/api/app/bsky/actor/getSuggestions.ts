import { InvalidRequestError } from '@atproto/xrpc-server'
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

      const suggestionsQb = db
        .selectFrom('user_account')
        .innerJoin('did_handle', 'user_account.did', 'did_handle.did')
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .where('did_handle.did', '!=', requester)
        .whereNotExists((qb) =>
          qb
            .selectFrom('follow')
            .selectAll()
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did')),
        )
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
          'user_account.createdAt as createdAt',
          db
            .selectFrom('post')
            .whereRef('creator', '=', ref('did_handle.did'))
            .select(countAll.as('count'))
            .as('postCount'),
        ])

      // PG doesn't let you do WHEREs on aliases, so we wrap it in a subquery
      let suggestionsReq = db
        .selectFrom(suggestionsQb.as('suggestions'))
        .selectAll()

      const keyset = new PostCountDidKeyset(ref('postCount'), ref('did'))
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
