import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.listTemplates({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ auth }) => {
      const access = auth.credentials
      const db = ctx.db

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a full moderator to view list of communication template',
        )
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      const list = await communicationTemplate.list()

      return {
        encoding: 'application/json',
        body: {
          communicationTemplates: list.map((item) =>
            communicationTemplate.view(item),
          ),
        },
      }
    },
  })
}
