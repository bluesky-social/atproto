import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.unassignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const result = await ctx.assignmentService.unassignReport({
        reportId: input.body.reportId,
      })

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
