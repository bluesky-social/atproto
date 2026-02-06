import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      const { did, newLegalId } = input.body

      // Validate Legal ID format
      if (!newLegalId.includes('@legal.')) {
        throw new InvalidRequestError(
          'Invalid Legal ID format. Must be in format: uuid@legal.domain',
          'InvalidLegalId',
        )
      }

      // Check if account exists
      const account = await ctx.accountManager.db.db
        .selectFrom('account')
        .select(['did'])
        .where('did', '=', did)
        .executeTakeFirst()

      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }

      // Check if the new Legal ID is already linked to a different account
      const existingLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'neuroJid'])
        .where('neuroJid', '=', newLegalId)
        .executeTakeFirst()

      if (existingLink && existingLink.did !== did) {
        throw new InvalidRequestError(
          `This Legal ID is already linked to account ${existingLink.did}`,
          'LegalIdInUse',
        )
      }

      // Get current link (if any)
      const currentLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['neuroJid'])
        .where('did', '=', did)
        .executeTakeFirst()

      const oldLegalId = currentLink?.neuroJid || null
      const updatedAt = new Date().toISOString()

      // Update or insert the link
      if (currentLink) {
        // Update existing link
        await ctx.accountManager.db.db
          .updateTable('neuro_identity_link')
          .set({
            neuroJid: newLegalId,
            linkedAt: updatedAt,
            lastLoginAt: null, // Reset last login
          })
          .where('did', '=', did)
          .execute()

        req.log.info(
          { did, oldLegalId, newLegalId },
          'Updated Neuro identity link',
        )
      } else {
        // Create new link
        await ctx.accountManager.db.db
          .insertInto('neuro_identity_link')
          .values({
            neuroJid: newLegalId,
            did,
            email: null,
            userName: null,
            linkedAt: updatedAt,
            lastLoginAt: null,
          })
          .execute()

        req.log.info({ did, newLegalId }, 'Created Neuro identity link')
      }

      return {
        encoding: 'application/json',
        body: {
          success: true,
          did,
          oldLegalId: oldLegalId || undefined,
          newLegalId,
          updatedAt,
        },
      }
    },
  })
}
