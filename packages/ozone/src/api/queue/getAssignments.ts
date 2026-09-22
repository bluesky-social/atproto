import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.queue.getAssignments, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const result = await ctx.assignmentService.getQueueAssignments(params)

      return {
        encoding: 'application/json',
        body: {
          assignments: result.assignments,
          cursor: result.cursor,
        },
      }
    },
  })
}
