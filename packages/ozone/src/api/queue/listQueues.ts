import { isNsidString } from '@atproto/lex'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.queue.listQueues, {
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

      // @TODO The lexicon should define the "collection" property as a NSID
      // string format (but it doesn't)
      if (collection != null && !isNsidString(collection)) {
        throw new InvalidRequestError(
          'Invalid collection NSID',
          'InvalidRequest',
        )
      }

      const queueService = ctx.queueService(ctx.db)

      const result = await queueService.list({
        limit,
        cursor,
        enabled,
        subjectType,
        collection,
        reportTypes,
      })

      const queues = await queueService.viewsWithStats(result.queues)

      return {
        encoding: 'application/json',
        body: {
          queues,
          cursor: result.cursor,
        },
      }
    },
  })
}
