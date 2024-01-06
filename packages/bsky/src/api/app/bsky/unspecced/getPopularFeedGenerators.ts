import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async (_reqCtx) => {
      // @TODO for appview v2
      throw new Error('unimplemented')
    },
  })
}
