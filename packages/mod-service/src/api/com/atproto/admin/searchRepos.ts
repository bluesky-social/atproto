import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      throw new InvalidRequestError('@TODO')
      // const db = ctx.db
      // const moderationService = ctx.services.moderation(db)
      // const { limit, cursor } = params
      // // prefer new 'q' query param over deprecated 'term'
      // const query = params.q ?? params.term
      // const { results, cursor: resCursor } = await ctx.services
      //   .actor(db)
      //   .getSearchResults({ query, limit, cursor, includeSoftDeleted: true })
      // return {
      //   encoding: 'application/json',
      //   body: {
      //     cursor: resCursor,
      //     repos: await moderationService.views.repo(results),
      //   },
      // }
    },
  })
}
