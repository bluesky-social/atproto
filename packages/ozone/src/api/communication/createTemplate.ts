import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { isDuplicateTemplateNameError } from '../../communication-service/util'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.createTemplate({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { createdBy, lang, ...template } = input.body

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

      try {
        const newTemplate = await communicationTemplate.create({
          ...template,
          // We are not using ?? here because we want to use null instead of potentially empty string
          lang: lang || null,
          disabled: false,
          lastUpdatedBy: createdBy,
        })

        return {
          encoding: 'application/json',
          body: communicationTemplate.view(newTemplate),
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
