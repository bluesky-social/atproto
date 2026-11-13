import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { queryModeratorActivity } from '../../report/moderator-activity.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.report.queryModeratorActivity, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, signal }) => {
      if (!auth.credentials.isAdmin) throw new ForbiddenError('Unauthorized')
      return {
        encoding: 'application/json',
        body: await queryModeratorActivity(ctx, params, signal),
      }
    },
  })
}
