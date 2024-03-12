import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.deleteTemplate({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { id } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError(
          'Must be an admin to delete a communication template',
        )
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      await communicationTemplate.delete(Number(id))
    },
  })
}
