import { AuthRequiredError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.communication.deleteTemplate, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { id } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to delete a communication template',
        )
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      await communicationTemplate.delete(Number(id))
    },
  })
}
