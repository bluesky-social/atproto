import { Server } from '../../../../lexicon'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { getDeclarationSimple } from '../util'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.feed.getVotes({
    auth: ServerAuth.verifier,
    handler: async ({ params, res }) => {
      const { uri, limit, before, cid, direction } = params
      const { db, imgUriBuilder } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('vote')
        .where('vote.subject', '=', uri)
        .innerJoin('did_handle', 'vote.creator', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .select([
          'vote.cid as cid',
          'vote.direction as direction',
          'vote.createdAt as createdAt',
          'vote.indexedAt as indexedAt',
          'did_handle.did as did',
          'did_handle.declarationCid as declarationCid',
          'did_handle.actorType as actorType',
          'did_handle.handle as handle',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
        ])

      if (direction === 'up' || direction === 'down') {
        builder = builder.where('vote.direction', '=', direction)
      }

      if (cid) {
        builder = builder.where('vote.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('vote.createdAt'), ref('vote.cid'))
      builder = paginate(builder, {
        limit,
        before,
        keyset,
      })

      const votesRes = await builder.execute()
      const votes = votesRes.map((row) => ({
        direction: row.direction,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
        actor: {
          did: row.did,
          declaration: getDeclarationSimple(row),
          handle: row.handle,
          displayName: row.displayName || undefined,
          avatar: row.avatarCid
            ? imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
            : undefined,
        },
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          cursor: keyset.packFromResult(votesRes),
          votes,
        },
      }
    },
  })
}
