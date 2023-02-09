import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getVotes({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, before, cid, direction } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('vote')
        .where('vote.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'vote.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'vote.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .selectAll('creator')
        .select([
          'vote.cid as cid',
          'vote.direction as direction',
          'vote.createdAt as createdAt',
          'vote.indexedAt as indexedAt',
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
      const actors = await services
        .actor(db)
        .views.actorWithInfo(votesRes, requester)

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          cursor: keyset.packFromResult(votesRes),
          votes: votesRes.map((row, i) => ({
            direction: row.direction,
            createdAt: row.createdAt,
            indexedAt: row.indexedAt,
            actor: actors[i],
          })),
        },
      }
    },
  })
}
