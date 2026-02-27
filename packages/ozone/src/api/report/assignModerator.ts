import { ForbiddenError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getAuthDid } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.assignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const authDid = getAuthDid(auth, ctx.cfg.service.did)

      if (!authDid) {
        throw new ForbiddenError('No one to assign report to')
      }

      const result = await ctx.assignmentService.assignReport({
        did: authDid,
        reportId: input.body.reportId,
        queueId: input.body.queueId,
        assign: input.body.assign || false,
      })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
