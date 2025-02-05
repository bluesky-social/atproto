import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { isDuplicateTemplateNameError } from '../../communication-service/util'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.updateTemplate({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { id, updatedBy, ...template } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to update a communication template',
        )
      }

      // Once auth starts providing us with the caller's DID, we can get rid of this check
      if (!updatedBy) {
        throw new InvalidRequestError('updatedBy field is required')
      }

      if (!Object.keys(template).length) {
        throw new InvalidRequestError('Missing update data in request body')
      }

      const communicationTemplate = ctx.communicationTemplateService(db)
      try {
        const updatedTemplate = await communicationTemplate.update(Number(id), {
          ...template,
          lastUpdatedBy: updatedBy,
        })

        return {
          encoding: 'application/json',
          body: communicationTemplate.view(updatedTemplate),
        }
      } catch (err) {
        if (isDuplicateTemplateNameError(err)) {
          throw new InvalidRequestError(
            `${template.name} already exists. Please choose a different name.`,
            'DuplicateTemplateName',
          )
        }
        throw err
      }
    },
  })
}
