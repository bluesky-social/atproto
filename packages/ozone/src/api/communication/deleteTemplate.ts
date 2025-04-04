import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.deleteTemplate({
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
