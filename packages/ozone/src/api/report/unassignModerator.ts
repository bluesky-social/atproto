import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getAuthDid } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.unassignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const authDid = getAuthDid(auth, ctx.cfg.service.did)
      const result = await ctx.assignmentService.unassignReport({
        reportId: input.body.reportId,
        createdBy: authDid,
      })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
