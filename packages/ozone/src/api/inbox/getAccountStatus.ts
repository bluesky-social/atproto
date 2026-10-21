import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
import { getAccountStanding } from '../../inbox/standing.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getAccountStatus, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => ({
      encoding: 'application/json',
      body: {
        src: ctx.cfg.service.did,
        ...(await getAccountStanding(
          ctx.db,
          inboxViewerDid(auth, params.did),
          ctx.cfg.strikeSuspension,
        )),
      },
    }),
  })
}
