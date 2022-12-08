import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { getDeclarationSimple } from '../util'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.feed.getRepostedBy({
    auth: ServerAuth.verifier,
    handler: async ({ params, res }) => {
      const { uri, limit, before, cid } = params
      const { db, imgUriBuilder } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('did_handle', 'did_handle.did', 'repost.creator')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .select([
          'did_handle.did as did',
          'did_handle.declarationCid as declarationCid',
          'did_handle.actorType as actorType',
          'did_handle.handle as handle',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
          'repost.cid as cid',
          'repost.createdAt as createdAt',
          'repost.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(
        ref('repost.createdAt'),
        ref('repost.cid'),
      )
      builder = paginate(builder, {
        limit,
        before,
        keyset,
      })

      const repostedByRes = await builder.execute()
      const repostedBy = repostedByRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName || undefined,
        avatar: row.avatarCid
          ? imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          repostedBy,
          cursor: keyset.packFromResult(repostedByRes),
        },
      }
    },
  })
}
