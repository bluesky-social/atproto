import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getConfig({
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          checkEmailConfirmed: ctx.cfg.clientCheckEmailConfirmed,
          topicsEnabled: ctx.cfg.topicsEnabled,
        },
      }
    },
  })
}
