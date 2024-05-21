import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.createTemplate({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { createdBy, ...template } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to create a communication template',
        )
      }

      // Once auth starts providing us with the caller's DID, we can get rid of this check
      if (!createdBy) {
        throw new InvalidRequestError('createdBy field is required')
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      const newTemplate = await communicationTemplate.create({
        ...template,
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
