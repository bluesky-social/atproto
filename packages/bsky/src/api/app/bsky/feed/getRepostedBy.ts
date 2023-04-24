import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('actor as creator', 'creator.did', 'repost.creator')
        .where(notSoftDeletedClause(ref('creator')))
        .selectAll('creator')
        .select(['repost.cid as cid', 'repost.sortAt as sortAt'])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('repost.sortAt'), ref('repost.cid'))
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const repostedByRes = await builder.execute()
      const repostedBy = await services
        .actor(db)
        .views.profile(repostedByRes, requester)

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
