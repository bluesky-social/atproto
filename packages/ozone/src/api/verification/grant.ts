import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getReposForVerifications } from '../../verification/util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.verification.grant({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth, req }) => {
      if (!ctx.cfg.verifier) {
        throw new InvalidRequestError('Verifier not configured')
      }

      if (!auth.credentials.isAdmin) {
        throw new AuthRequiredError(
          'Must be a full admin to grant verifications',
        )
      }

      const verificationIssuer = ctx.verificationIssuer(ctx.cfg.verifier)
      const verificationService = ctx.verificationService(ctx.db)
      const { grantedVerifications, failedVerifications } =
        await verificationIssuer.verify(input.body.verifications)

      if (!grantedVerifications.length) {
        return {
          encoding: 'application/json',
          body: {
            verifications: [],
            failedVerifications,
          },
        }
      }

      await verificationService.create(grantedVerifications)

      const dids = new Set<string>([ctx.cfg.verifier.did])

      for (const verification of grantedVerifications) {
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
      const verifications = verificationService.view(
        grantedVerifications,
        repos,
      )
      return {
        encoding: 'application/json',
        body: {
          verifications: [...verifications, ...failedVerifications],
        },
      }
    },
  })
}
