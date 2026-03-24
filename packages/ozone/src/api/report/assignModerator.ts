import { ForbiddenError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getAuthDid } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.assignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const authDid = getAuthDid(auth, ctx.cfg.service.did)
      const did = input.body.did ?? authDid

      if (!did) {
        throw new ForbiddenError('No one to assign report to')
      }

      // RuBAC: only admins can assign to a different user
      if (did !== authDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }

      const result = await ctx.assignmentService.assignReport({
        did,
        createdBy: authDid,
        reportId: input.body.reportId,
        queueId: input.body.queueId,
        isPermanent: input.body.isPermanent,
      })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
