import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { adminVerifier } from '../../../auth'
import { paginate } from '../../../../db/pagination'
import { ListKeyset } from '../../../../services/actor'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: adminVerifier(ctx.cfg.adminPassword),
    handler: async ({ params }) => {
      const { db, services } = ctx
      const moderationService = services.moderation(db)
      const { term = '', limit, cursor, invitedBy } = params
      if (invitedBy) {
        throw new InvalidRequestError('The invitedBy parameter is unsupported')
      }

      const { ref } = db.db.dynamic
      const keyset = new ListKeyset(ref('indexedAt'), ref('handle'))
      let resultQb = services.actor(db).searchQb(term).selectAll()
      resultQb = paginate(resultQb, { keyset, cursor, limit })

      const results = await resultQb.execute()

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(results),
          repos: await moderationService.views.repo(results),
        },
      }
    },
  })
}
