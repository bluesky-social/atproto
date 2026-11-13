import type { Server } from '@atproto/xrpc-server'
import { AGE_ASSURANCE_CONFIG } from '../../../../api/age-assurance/const.js'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.ageassurance.getConfig, {
    auth: ctx.authVerifier.standardOptional,
    handler: async () => {
      return {
        encoding: 'application/json',
        body: AGE_ASSURANCE_CONFIG,
      }
    },
  })
}
