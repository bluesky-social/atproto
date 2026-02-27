import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.updateQueue({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to update a queue')
      }

      const { queueId, name, enabled } = input.body

      if (name === undefined && enabled === undefined) {
        throw new InvalidRequestError(
          'At least one of name or enabled must be provided',
        )
      }

      const queueService = ctx.queueService(ctx.db)

      const existing = await queueService.getById(queueId)
      if (!existing) {
        throw new InvalidRequestError(
          `Queue with id ${queueId} does not exist`,
          'QueueNotFound',
        )
      }

      const updates: { name?: string; enabled?: boolean } = {}
      if (name !== undefined) updates.name = name
      if (enabled !== undefined) updates.enabled = enabled

      const queue = await queueService.update(queueId, updates)

      return {
        encoding: 'application/json',
        body: { queue: queueService.view(queue) },
      }
    },
  })
}
