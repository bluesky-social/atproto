import { AGE_ASSURANCE_CONFIG } from '../../../../api/age-assurance/const'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.ageassurance.getConfig({
    auth: ctx.authVerifier.standardOptional,
    handler: async () => {
      return {
        encoding: 'application/json',
        body: AGE_ASSURANCE_CONFIG,
      }
    },
  })
}
