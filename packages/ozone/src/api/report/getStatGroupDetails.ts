import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { QueueAccess } from '../../queue/access.js'
import { getStatGroupDetails } from '../../report/stat-group-details.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.report.getStatGroupDetails, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, signal }) => {
      const { queueId, moderatorDid, reportTypes } = params
      const groupCount = [
        queueId !== undefined,
        moderatorDid !== undefined,
        reportTypes !== undefined,
      ].filter(Boolean).length
      if (groupCount > 1 || queueId === 0) {
        throw new InvalidRequestError('Select at most one stat group')
      }
      if (moderatorDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }
      const access = await QueueAccess.forActor(ctx.db, auth.credentials)
      if (queueId !== undefined && queueId > 0) {
        access.assertQueue(queueId)
        const queue = await ctx.db.db
          .selectFrom('report_queue')
          .select('id')
          .where('id', '=', queueId)
          .where('deletedAt', 'is', null)
          .executeTakeFirst()
        if (!queue) {
          throw new InvalidRequestError('Queue not found', 'QueueNotFound')
        }
      }
      const body = await getStatGroupDetails(ctx.db, params, access, signal)
      return { encoding: 'application/json', body }
    },
  })
}
