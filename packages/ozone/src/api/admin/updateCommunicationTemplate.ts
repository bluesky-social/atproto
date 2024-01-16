import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateCommunicationTemplate({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { id, updatedBy, ...template } = input.body

      if (!access.moderator) {
        throw new AuthRequiredError(
          'Must be a full moderator to update a communication template',
        )
      }

      if (!Object.keys(template).length) {
        throw new InvalidRequestError('Missing update data in request body')
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      const updatedTemplate = await communicationTemplate.update(id, {
        ...template,
        updatedAt: new Date(),
        lastUpdatedBy: updatedBy,
      })

      return {
        encoding: 'application/json',
        body: communicationTemplate.view(updatedTemplate),
      }
    },
  })
}
