import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const { invitedBy } = params
      if (invitedBy) {
        throw new InvalidRequestError('The invitedBy parameter is unsupported')
      }
      // prefer new 'q' query param over deprecated 'term'
      const { q } = params
      if (q) {
        params.term = q
      }

      const { results, cursor } = await ctx.services
        .actor(db)
        .getSearchResults({ ...params, includeSoftDeleted: true })
      return {
        encoding: 'application/json',
        body: {
          cursor,
          repos: await moderationService.views.repo(results),
        },
      }
    },
  })
}
