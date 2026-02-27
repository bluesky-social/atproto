import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.listQueues({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const {
        limit = 50,
        cursor,
        enabled,
        subjectType,
        collection,
        reportTypes,
      } = params

      const queueService = ctx.queueService(ctx.db)

      const result = await queueService.list({
        limit,
        cursor,
        enabled,
        subjectType,
        collection,
        reportTypes,
      })

      return {
        encoding: 'application/json',
        body: {
          queues: result.queues.map((q) => queueService.view(q)),
          cursor: result.cursor,
        },
      }
    },
  })
}
