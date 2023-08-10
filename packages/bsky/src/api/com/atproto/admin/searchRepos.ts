import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { paginate } from '../../../../db/pagination'
import { ListKeyset } from '../../../../services/actor'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const { term = '', limit, cursor, invitedBy } = params
      if (invitedBy) {
        throw new InvalidRequestError('The invitedBy parameter is unsupported')
      }

      const searchField = term.startsWith('did:') ? 'did' : 'handle'

      const { ref } = db.db.dynamic
      const keyset = new ListKeyset(ref('indexedAt'), ref('did'))
      let resultQb = ctx.services
        .actor(db)
        .searchQb(searchField, term)
        .selectAll()
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
