import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getConfig({
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          checkEmailConfirmed: ctx.cfg.clientCheckEmailConfirmed,
        },
      }
    },
  })
}
