import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.createInvitation({
    handler: async ({ req, input }) => {
      validateAdminAuth(req, ctx)

      const { email, preferredHandle, invitationTimestamp } = input.body as {
        email?: string
        preferredHandle?: string | null
        invitationTimestamp?: number
      }

      if (!email || !email.trim()) {
        throw new InvalidRequestError('email is required')
      }

      if (!Number.isInteger(invitationTimestamp)) {
        throw new InvalidRequestError('invitationTimestamp is required')
      }

      const normalizedEmail = email.trim().toLowerCase()
      let invitation

      try {
        // Step 1: Check for existing active invitation by email hash
        const emailHash = ctx.invitationManager.hashEmail(normalizedEmail)
        const existingInvitation =
          await ctx.invitationManager.getActiveInvitationByEmailHash(emailHash)

        if (existingInvitation && existingInvitation.jid) {
          // Reuse existing JID/onboarding URL for reminder send
          req.log.info(
            {
              invitationId: existingInvitation.id,
              hasJid: true,
              expiresAt: existingInvitation.expires_at,
            },
            'Reusing existing invitation for reminder',
          )

          // Update preferred handle if provided
          if (preferredHandle !== undefined) {
            await ctx.invitationManager.updateInvitationForReminder(
              existingInvitation.id,
              preferredHandle,
            )
          } else {
            await ctx.invitationManager.updateInvitationForReminder(
              existingInvitation.id,
            )
          }

          invitation = await ctx.accountManager.db.db
            .selectFrom('pending_invitations')
            .selectAll()
            .where('id', '=', existingInvitation.id)
            .executeTakeFirst()

          // Email sending handled by CLI (pds-wadmin), not by PDS
        } else {
          // Step 2: No reusable invitation - allocate account from WID inventory
          req.log.info('Allocating WID account from inventory')

          let jid: string
          let onboardingUrl: string

          try {
            const inventoryAccount =
              await ctx.widInventoryManager.allocateAccount(normalizedEmail)

            if (!inventoryAccount) {
              throw new Error('No WID accounts available in inventory')
            }

            // Use the DID from inventory as the JID
            jid = inventoryAccount.did
            onboardingUrl = inventoryAccount.onboarding_url

            req.log.info(
              {
                jid: jid.substring(0, 8) + '...',
                allocated_to: normalizedEmail.substring(0, 3) + '***',
              },
              'WID account allocated from inventory',
            )
          } catch (inventoryErr) {
            const errorMsg =
              inventoryErr instanceof Error
                ? inventoryErr.message
                : String(inventoryErr)
            req.log.error(
              { error: errorMsg },
              'WID inventory allocation failed',
            )
            throw new InvalidRequestError(
              errorMsg.includes('No WID accounts available')
                ? 'No WID accounts available in inventory. Load more accounts to continue.'
                : 'Failed to allocate WID account from inventory',
              'InventoryAllocationError',
            )
          }

          // Step 3: Persist invitation with JID (only after successful inventory allocation)
          invitation = await ctx.invitationManager.createInvitationWithJid(
            normalizedEmail,
            jid,
            onboardingUrl,
            preferredHandle,
            invitationTimestamp,
          )

          // Email sending handled by CLI (pds-wadmin), not by PDS
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('PDS_INVITATION_EMAIL_HASH_SALT')) {
          throw new InvalidRequestError(message, 'InvitationConfigError')
        }
        if (err instanceof InvalidRequestError) {
          throw err
        }
        req.log.error({ error: message }, 'Invitation creation failed')
        throw new InvalidRequestError('Invitation creation failed')
      }

      if (!invitation) {
        throw new InvalidRequestError('Failed to create or update invitation')
      }

      const qrCodeUrl = invitation.jid
        ? (await ctx.widInventoryManager.getAccountByDid(invitation.jid))
            ?.qr_code_url ?? undefined
        : undefined

      // Log invitation details for debugging/tracking
      req.log.info(
        {
          invitationId: invitation.id,
          email: normalizedEmail.substring(0, 3) + '***',
          onboardingUrl: invitation.onboarding_url?.substring(0, 40) + '...',
          qrCodeUrl: qrCodeUrl?.substring(0, 40) + '...',
        },
        'Invitation ready for email',
      )

      return {
        encoding: 'application/json',
        body: {
          success: true,
          email: invitation.email,
          preferredHandle: invitation.preferred_handle ?? undefined,
          onboardingUrl: invitation.onboarding_url ?? undefined,
          qrCodeUrl: qrCodeUrl,
          expiresAt: invitation.expires_at,
          emailStatus: invitation.status,
          // JID is not returned for privacy (admin doesn't need it)
        },
      }
    },
  })
}
