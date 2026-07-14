import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getConfig, {
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          checkEmailConfirmed: ctx.cfg.clientCheckEmailConfirmed,
          // @ts-expect-error un-specced field
          topicsEnabled: ctx.cfg.topicsEnabled,
          liveNow: ctx.cfg.liveNowConfig,
        } satisfies app.bsky.unspecced.getConfig.$OutputBody,
      }
    },
  })
}
