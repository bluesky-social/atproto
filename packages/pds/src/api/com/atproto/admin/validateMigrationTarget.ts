import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.validateMigrationTarget({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ params, req }) => {
      const { did, legalId, targetHandle } = params

      req.log.info(
        { did, legalId, targetHandle },
        'Validating migration target',
      )

      const checks = {
        didAvailable: false,
        legalIdAvailable: false,
        handleAvailable: false,
      }

      let canAccept = true
      let error: string | undefined

      try {
        // Check 1: DID should not already exist on this PDS
        const existingActor = await ctx.accountManager.db.db
          .selectFrom('actor')
          .select('did')
          .where('did', '=', did)
          .executeTakeFirst()

        checks.didAvailable = !existingActor

        if (existingActor) {
          canAccept = false
          error = 'Account with this DID already exists on target PDS'
        }

        // Check 2: W ID (Neuro Legal ID) should not be linked to a different account
        if (legalId) {
          const existingLink = await ctx.accountManager.db.db
            .selectFrom('neuro_identity_link')
            .select(['did', 'legalId'])
            .where('legalId', '=', legalId)
            .executeTakeFirst()

          checks.legalIdAvailable = !existingLink || existingLink.did === did

          if (existingLink && existingLink.did !== did) {
            canAccept = false
            error = `W ID ${legalId} is already linked to a different account on target PDS`
          }
        } else {
          // No Neuro JID to check - mark as available
          checks.legalIdAvailable = true
        }

        // Check 3: Handle should be available (if changing handle)
        if (targetHandle) {
          const handleTaken = await ctx.accountManager.db.db
            .selectFrom('actor')
            .select('handle')
            .where('handle', '=', targetHandle)
            .executeTakeFirst()

          checks.handleAvailable = !handleTaken

          if (handleTaken) {
            canAccept = false
            error = `Handle ${targetHandle} is not available on target PDS`
          }
        } else {
          // No handle change - mark as available
          checks.handleAvailable = true
        }

        req.log.info(
          { did, canAccept, checks },
          'Migration target validation completed',
        )

        return {
          encoding: 'application/json' as const,
          body: {
            canAccept,
            checks,
            error,
          },
        }
      } catch (err) {
        req.log.error({ did, err }, 'Migration target validation failed')
        throw new InvalidRequestError(
          'Failed to validate migration target',
          'ValidationFailed',
        )
      }
    },
  })
}
