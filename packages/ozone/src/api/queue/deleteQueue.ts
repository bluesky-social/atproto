import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.deleteQueue({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to delete a queue')
      }

      const { queueId, migrateToQueueId } = input.body

      const queueService = ctx.queueService(ctx.db)

      const existing = await queueService.getById(queueId)
      if (!existing) {
        throw new InvalidRequestError(
          `Queue with id ${queueId} does not exist`,
          'QueueNotFound',
        )
      }

      if (migrateToQueueId !== undefined) {
        const targetQueue = await queueService.getById(migrateToQueueId)
        if (!targetQueue) {
          throw new InvalidRequestError(
            `Target queue with id ${migrateToQueueId} does not exist`,
            'QueueNotFound',
          )
        }
      }

      // Migrate non-closed reports before soft-deleting the queue.
      // Closed reports are left assigned to the deleted queue — their history is preserved.
      // Non-closed reports go to migrateToQueueId if specified, otherwise to -1 (unmatched).
      const reportsMigrated = await queueService.migrateReports(
        queueId,
        migrateToQueueId,
      )

      await queueService.delete(queueId)

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
