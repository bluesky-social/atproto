import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import { getAuthDid } from '../util.js'

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
