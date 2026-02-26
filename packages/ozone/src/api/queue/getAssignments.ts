import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.getAssignments({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const assignments =
        await ctx.assignmentService.getQueueAssignments(params)

      return {
        encoding: 'application/json',
        body: {
          assignments,
        },
      }
    },
  })
}
