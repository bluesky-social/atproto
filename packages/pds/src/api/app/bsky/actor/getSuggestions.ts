import ServerAuth from '../../../../auth'
import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import { getDeclarationSimple } from '../util'

export default function (server: Server) {
  server.app.bsky.actor.getSuggestions({
    auth: ServerAuth.verifier,
    handler: async ({ params, auth, res }) => {
      let { limit } = params
      const { cursor } = params
      const { db, imgUriBuilder } = locals.get(res)
      const requester = auth.credentials.did
      limit = Math.min(limit ?? 25, 100)

      const { ref } = db.db.dynamic

      const suggestionsReq = db.db
        .selectFrom('user')
        .innerJoin('did_handle', 'user.handle', 'did_handle.handle')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
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
          db.db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollow'),
        ])
        .orderBy(ref('user.createdAt'), 'asc')
        .if(limit !== undefined, (q) => q.limit(limit as number))
        .if(cursor !== undefined, (q) =>
          q.where(ref('user.createdAt'), '>', cursor),
        )

      const suggestionsRes = await suggestionsReq.execute()

      const actors = suggestionsRes.map((result) => ({
        did: result.did,
        handle: result.handle,
        declaration: getDeclarationSimple(result),
        displayName: result.displayName ?? undefined,
        description: result.description ?? undefined,
        avatar: result.avatarCid
          ? imgUriBuilder.getCommonSignedUri('avatar', result.avatarCid)
          : undefined,
        indexedAt: result.indexedAt ?? undefined,
        myState: {
          follow: result.requesterFollow || undefined,
        },
      }))

      const lastResult = suggestionsRes.at(-1)
      return {
        encoding: 'application/json',
        body: {
          actors,
          cursor: lastResult?.createdAt,
        },
      }
    },
  })
}
