import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getAssignments({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const assignments = await ctx.assignmentService.getAssignments({
        ...params,
        type: 'report',
      })

      return {
        encoding: 'application/json' as const,
        body: {
          assignments: assignments.map((a) => ({
            id: a.id,
            did: a.did,
            reportId: a.reportId!,
            queueId: a.queueId ?? undefined,
            startAt: a.startAt,
            endAt: a.endAt,
          })),
        },
      }
    },
  })
}
