import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.createCommunicationTemplate({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { createdBy, ...template } = input.body

      if (!access.admin) {
        throw new AuthRequiredError(
          'Must be an admin to create a communication template',
        )
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      const newTemplate = await communicationTemplate.create({
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
        disabled: false,
        lastUpdatedBy: createdBy,
      })

      return {
        encoding: 'application/json',
        body: communicationTemplate.view(newTemplate),
      }
    },
  })
}
