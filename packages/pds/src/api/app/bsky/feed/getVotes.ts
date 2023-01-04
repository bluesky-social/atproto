import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { getDeclarationSimple } from '../util'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getVotes({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      const { uri, limit, before, cid, direction } = params
      const { ref } = ctx.db.db.dynamic

      let builder = ctx.db.db
        .selectFrom('vote')
        .where('vote.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'vote.creator')
        .leftJoin('profile', 'profile.creator', 'vote.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'vote.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .select([
          'vote.cid as cid',
          'vote.direction as direction',
          'vote.createdAt as createdAt',
          'vote.indexedAt as indexedAt',
          'creator.did as did',
          'creator.declarationCid as declarationCid',
          'creator.actorType as actorType',
          'creator.handle as handle',
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
            ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
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
