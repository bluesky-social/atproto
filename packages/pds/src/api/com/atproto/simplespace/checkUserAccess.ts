import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.checkUserAccess, {
    // The authority calls this on a space's managingApp (service auth, iss =
    // authority, aud = managingApp). A generic PDS is not a managing app, so
    // the baseline implementation denies. A real managing app overrides this
    // with its own application-layer policy (follower graphs, subscriptions,
    // join approvals, etc.).
    auth: ctx.authVerifier.serviceAuth,
    handler: async () => {
      return {
        encoding: 'application/json' as const,
        body: { authorized: false },
      }
    },
  })
}
