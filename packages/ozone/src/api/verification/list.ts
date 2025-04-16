import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getReposForVerifications } from '../../verification/util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.verification.list({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ req, params, auth }) => {
      const verificationService = ctx.verificationService(ctx.db)
      const { verifications, cursor } = await verificationService.list(params)

      const dids = new Set<string>()
      for (const verification of verifications) {
        dids.add(verification.subject)
      }

      const didsArr = Array.from(dids)
      const repos = await getReposForVerifications(
        ctx,
        ctx.reqLabelers(req),
        ctx.modService(ctx.db),
        didsArr,
        auth.credentials.isModerator,
      )

      return {
        encoding: 'application/json',
        body: {
          cursor,
          verifications: verificationService.view(verifications, repos),
        },
      }
    },
  })
}
