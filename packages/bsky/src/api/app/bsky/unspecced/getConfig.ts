import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getConfig, {
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          checkEmailConfirmed: ctx.cfg.clientCheckEmailConfirmed,
          topicsEnabled: ctx.cfg.topicsEnabled,
          liveNow: ctx.cfg.liveNowConfig,
        },
      }
    },
  })
}
