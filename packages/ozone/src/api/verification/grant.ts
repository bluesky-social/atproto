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

      if (!auth.credentials.isAdmin && !auth.credentials.isVerifier) {
        throw new AuthRequiredError(
          'Must be an admin or verifier to grant verifications',
        )
      }

      const modViews = ctx.modService(ctx.db).views
      const verificationIssuer = ctx.verificationIssuer(ctx.cfg.verifier)
      const verificationService = ctx.verificationService(ctx.db)
      const { grantedVerifications, failedVerifications } =
        await verificationIssuer.verify(input.body.verifications)

      if (!grantedVerifications.length) {
        return {
          encoding: 'application/json',
          body: {
            verifications: [...failedVerifications],
          },
        }
      }

      await verificationService.create(grantedVerifications)

      const dids = new Set<string>([ctx.cfg.verifier.did])

      for (const verification of grantedVerifications) {
        dids.add(verification.subject)
      }

      const didsArr = Array.from(dids)
      const [repos, profiles] = await Promise.all([
        getReposForVerifications(
          ctx,
          ctx.reqLabelers(req),
          ctx.modService(ctx.db),
          didsArr,
          auth.credentials.isModerator,
        ),
        modViews.getProfiles(didsArr),
      ])
      const verifications = verificationService.view(
        grantedVerifications,
        repos,
        profiles,
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
