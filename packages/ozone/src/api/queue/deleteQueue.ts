import {
  AuthRequiredError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { QueueAccess } from '../../queue/access.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.queue.deleteQueue, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to delete a queue')
      }

      const { queueId, migrateToQueueId } = input.body

      const reportsMigrated = await ctx.db.transaction(async (dbTxn) => {
        const queueService = ctx.queueService(dbTxn)
        const queueIds = new Set([queueId])
        if (migrateToQueueId !== undefined) queueIds.add(migrateToQueueId)
        const existingQueueIds = new Set<number>()
        // @NOTE Lock in ID order so opposing migrations cannot deadlock on queues.
        for (const id of [...queueIds].sort((a, b) => a - b)) {
          if (await queueService.getById(id, true)) existingQueueIds.add(id)
        }

        if (!existingQueueIds.has(queueId)) {
          throw new InvalidRequestError(
            `Queue with id ${queueId} does not exist`,
            'QueueNotFound',
          )
        }
        if (
          migrateToQueueId !== undefined &&
          !existingQueueIds.has(migrateToQueueId)
        ) {
          throw new InvalidRequestError(
            `Target queue with id ${migrateToQueueId} does not exist`,
            'QueueNotFound',
          )
        }

        const queueAccess = await QueueAccess.forActor(dbTxn, access)
        for (const id of queueIds) queueAccess.assertQueue(id)

        // Migrate non-closed reports before soft-deleting the queue.
        // Closed reports are left assigned to the deleted queue — their history is preserved.
        // Non-closed reports go to migrateToQueueId if specified, otherwise to -1 (unmatched).
        const migrated = await queueService.migrateReports(
          queueId,
          migrateToQueueId,
        )

        await queueService.delete(queueId)
        return migrated
      })

      return {
        encoding: 'application/json',
        body: {
          deleted: true,
          reportsMigrated,
        },
      }
    },
  })
}
