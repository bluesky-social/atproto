import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getAssignments({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { assignments, cursor } =
        await ctx.assignmentService.getReportAssignments(params)

      return {
        encoding: 'application/json',
        body: {
          assignments,
          cursor,
        },
      }
    },
  })
}
