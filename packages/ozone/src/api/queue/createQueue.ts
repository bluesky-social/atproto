import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.createQueue({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to create a queue')
      }

      const { name, subjectTypes, collection, reportTypes } = input.body
      const createdBy =
        access.type === 'admin_token' ? 'admin_token' : access.iss

      const queueService = ctx.queueService(ctx.db)

      await queueService.checkConflict({
        subjectTypes,
        collection,
        reportTypes,
      })

      const queue = await queueService.create({
        name,
        subjectTypes,
        collection,
        reportTypes,
        createdBy,
      })

      return {
        encoding: 'application/json',
        body: { queue: queueService.view(queue) },
      }
    },
  })
}
