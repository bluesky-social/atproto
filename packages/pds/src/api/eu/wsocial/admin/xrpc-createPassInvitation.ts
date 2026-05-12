import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { genInvCode } from '../../../com/atproto/server/util'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.createPassInvitation({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      const { email, preferredHandle } = input.body

      if (!email || !email.trim()) {
        throw new InvalidRequestError('email is required')
      }

      const normalizedEmail = email.trim().toLowerCase()

      // Generate a single-use atproto invite code
      let inviteCode: string
      try {
        inviteCode = genInvCode(ctx.cfg)
        await ctx.accountManager.createInviteCodes(
          [{ account: 'admin', codes: [inviteCode] }],
          1,
        )
      } catch (err) {
        req.log.error({ err }, 'Failed to generate invite code for pass invitation')
        throw new InvalidRequestError(
          'Failed to generate invite code',
          'InviteCodeGenerationError',
        )
      }

      // Build the onboarding URL with invite code, email and handle baked in.
      // Use emailBranding.appUrl (PDS_EMAIL_APP_URL / PDS_HOME_URL) as the base
      // — this points to the frontend (e.g. https://wsocial.eu), not the PDS.
      const appUrl = ctx.cfg.emailBranding.appUrl.replace(/\/$/, '')
      const params = new URLSearchParams({ inviteCode, email: normalizedEmail })
      if (preferredHandle) params.set('handle', preferredHandle)
      const onboardingUrl = `${appUrl}/onboarding?${params.toString()}`

      // Persist the pending_invitations row so email can be auto-verified at
      // account creation time (email-match check in createAccount handler)
      let invitation
      try {
        invitation = await ctx.invitationManager.createInvitationWithInviteCode(
          normalizedEmail,
          inviteCode,
          onboardingUrl,
          preferredHandle ?? null,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('PDS_INVITATION_EMAIL_HASH_SALT')) {
          throw new InvalidRequestError(message, 'InvitationConfigError')
        }
        req.log.error({ err }, 'Failed to create pass invitation row')
        throw new InvalidRequestError('Failed to create invitation')
      }

      req.log.info(
        {
          invitationId: invitation.id,
          email: normalizedEmail.substring(0, 3) + '***',
        },
        'Pass invitation created',
      )

      return {
        encoding: 'application/json',
        body: {
          email: invitation.email,
          inviteCode,
          onboardingUrl,
          preferredHandle: invitation.preferred_handle ?? undefined,
          expiresAt: invitation.expires_at,
        },
      }
    },
  })
}
