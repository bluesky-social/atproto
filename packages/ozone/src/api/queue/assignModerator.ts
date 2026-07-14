import { ForbiddenError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import { getAuthDid } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.assignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const { queueId, did } = input.body
      const authDid = getAuthDid(auth, ctx.cfg.service.did)

      // RBAC
      if (!auth.credentials.isModerator) {
        throw new ForbiddenError('Unauthorized')
      }

      // RuBAC
      if (did !== authDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }

      const result = await ctx.assignmentService.assignQueue({ did, queueId })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
