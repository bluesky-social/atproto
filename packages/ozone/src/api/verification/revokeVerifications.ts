import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.verification.revokeVerifications({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      if (!ctx.cfg.verifier) {
        throw new InvalidRequestError('Verifier not configured')
      }

      if (!auth.credentials.isVerifier) {
        throw new AuthRequiredError(
          'Must be an admin or verifier to revoke verifications',
        )
      }

      const verificationIssuer = ctx.verificationIssuer(ctx.cfg.verifier)
      const { uris, revokeReason } = input.body
      const { revokedVerifications, failedRevocations } =
        await verificationIssuer.revoke({ uris })

      if (revokedVerifications.length) {
        const verificationService = ctx.verificationService(ctx.db)
        await verificationService.markRevoked({
          uris: revokedVerifications,
          revokeReason,
          revokedBy:
            'iss' in auth.credentials ? auth.credentials.iss : undefined,
        })
      }

      return {
        encoding: 'application/json',
        body: {
          revokedVerifications,
          failedRevocations,
        },
      }
    },
  })
}
