import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.listCommunicationTemplates({
    auth: ctx.roleVerifier,
    handler: async () => {
      const db = ctx.db

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
