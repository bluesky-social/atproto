import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.report.getAssignments, {
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
