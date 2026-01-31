import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// Allowed target PDS domains for W Social infrastructure
const ALLOWED_TARGET_DOMAINS = [
  'wsocial.eu',
  'wsocial.network',
  'wsocial.cloud',
]

function validateTargetDomain(targetPdsUrl: string): void {
  const url = new URL(targetPdsUrl)
  const domain = url.hostname

  const isAllowed = ALLOWED_TARGET_DOMAINS.some((allowed) =>
    domain.endsWith(allowed)
  )

  if (!isAllowed) {
    throw new InvalidRequestError(
      `Target PDS domain not allowed. Must end with one of: ${ALLOWED_TARGET_DOMAINS.join(', ')}`,
      'InvalidTargetDomain'
    )
  }
}

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.migrateAccount({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      const { did, targetPdsUrl, targetHandle, skipDeactivation } = input.body

      req.log.info(
        { did, targetPdsUrl, targetHandle, skipDeactivation },
        'Starting admin account migration'
      )

      // Validate target domain whitelist
      try {
        validateTargetDomain(targetPdsUrl)
        req.log.info({ targetPdsUrl }, 'Target domain validated')
      } catch (err) {
        req.log.error({ targetPdsUrl, err }, 'Invalid target domain')
        throw err
      }

      // TODO: Implement full migration flow in Phase 2
      // For Phase 1, we just validate the setup

      throw new InvalidRequestError(
        'Migration flow not yet implemented. Phase 1 validation complete.',
        'NotImplemented'
      )
    },
  })
}
