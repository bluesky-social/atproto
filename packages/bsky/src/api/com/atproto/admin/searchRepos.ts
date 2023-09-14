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
