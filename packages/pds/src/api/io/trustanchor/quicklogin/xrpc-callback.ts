import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  NeuroCallbackPayload,
  createAccountViaQuickLogin,
  extractEmail,
  extractUserName,
  getHandleForDid,
} from './helpers'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.quicklogin.callback({
    handler: async ({ input, req }) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError('QuickLogin not enabled')
      }

      const payload = input.body as NeuroCallbackPayload

      req.log.info(
        {
          sessionId: payload.SessionId,
          key: payload.Key,
          state: payload.State,
        },
        'QuickLogin callback received (XRPC)',
      )

      // The provider sends back its own SessionId, but we need to look up by Key (serviceId)
      const serviceId = payload.Key
      if (!serviceId) {
        req.log.warn({ payload }, 'Missing Key/serviceId in callback')
        throw new InvalidRequestError('Missing Key')
      }

      // Find session by serviceId
      const session = ctx.quickloginStore.getSessionByServiceId(serviceId)
      if (!session) {
        req.log.warn({ serviceId }, 'Session not found for serviceId')
        throw new InvalidRequestError('Session not found', 'NotFound')
      }

      // Check if session expired
      if (new Date() > new Date(session.expiresAt)) {
        req.log.warn({ sessionId: payload.SessionId }, 'Session expired')
        throw new InvalidRequestError('Session expired')
      }

      // Validate state (mTLS handles signature verification)
      if (payload.State !== 'Approved') {
        req.log.info(
          { sessionId: session.sessionId, state: payload.State },
          'QuickLogin not approved',
        )
        ctx.quickloginStore.updateSession(session.sessionId, {
          status: 'failed',
          error: `QuickLogin ${payload.State}`,
        })
        throw new InvalidRequestError(`QuickLogin ${payload.State}`)
      }

      // Extract JID from payload
      const jid = payload.JID
      if (!jid) {
        req.log.error({ payload }, 'JID missing from callback')
        ctx.quickloginStore.updateSession(session.sessionId, {
          status: 'failed',
          error: 'JID missing',
        })
        throw new InvalidRequestError('JID missing from callback')
      }

      req.log.info({ jid }, 'Processing QuickLogin for JID')

      // Check if this Neuro identity is already linked
      const existingLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('neuroJid', '=', jid)
        .executeTakeFirst()

      let did: string
      let accessJwt: string
      let refreshJwt: string
      let handle: string

      if (existingLink) {
        // User has logged in via QuickLogin before - use existing link
        req.log.info(
          { jid, did: existingLink.did },
          'Existing Neuro identity link found',
        )

        did = existingLink.did
        handle = await getHandleForDid(ctx, did)

        // Update last login
        await ctx.accountManager.db.db
          .updateTable('neuro_identity_link')
          .set({ lastLoginAt: new Date().toISOString() })
          .where('neuroJid', '=', jid)
          .execute()

        // Create session
        const account = await ctx.accountManager.getAccount(did)
        if (!account) {
          req.log.error({ did }, 'Account not found for linked DID')
          throw new InvalidRequestError('Account not found')
        }

        const tokens = await ctx.accountManager.createSession(did, null, false)
        accessJwt = tokens.accessJwt
        refreshJwt = tokens.refreshJwt
      } else {
        // No existing link - this is user's first QuickLogin (but account should exist)
        const email = extractEmail(payload.Properties)
        const userName = extractUserName(payload.Properties)

        if (!email) {
          req.log.error({ jid }, 'No email found in QuickLogin payload')
          ctx.quickloginStore.updateSession(session.sessionId, {
            status: 'failed',
            error: 'Email required',
          })
          throw new InvalidRequestError('Email required')
        }

        // Check if invitation is required and exists
        const inviteRequired = ctx.cfg.invites?.required ?? false
        let invitation: Awaited<
          ReturnType<typeof ctx.invitationManager.getInvitationByEmail>
        > = null

        if (inviteRequired) {
          invitation = await ctx.invitationManager.getInvitationByEmail(email)

          if (!invitation) {
            req.log.warn(
              { email: ctx.invitationManager.hashEmail(email), jid },
              'No invitation found - access denied',
            )
            ctx.quickloginStore.updateSession(session.sessionId, {
              status: 'failed',
              error: 'Invitation required',
            })
            throw new InvalidRequestError(
              'An invitation is required to create an account. Please contact support.',
              'InvitationRequired',
            )
          }

          req.log.info(
            {
              email: ctx.invitationManager.hashEmail(email),
              preferredHandle: invitation.preferred_handle,
            },
            'Valid invitation found',
          )
        }

        // Find the existing account by email
        const existingAccount = await ctx.accountManager.db.db
          .selectFrom('account')
          .selectAll()
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst()

        if (!existingAccount) {
          // Account doesn't exist yet
          if (inviteRequired && !invitation) {
            req.log.error({ jid, email }, 'No invitation and account not found')
            ctx.quickloginStore.updateSession(session.sessionId, {
              status: 'failed',
              error: 'Invitation required',
            })
            throw new InvalidRequestError(
              'An invitation is required to create an account.',
              'InvitationRequired',
            )
          }

          // Create new account with invitation (if available)
          req.log.info(
            { jid, email, preferredHandle: invitation?.preferred_handle },
            'Creating new account via QuickLogin',
          )

          const preferredHandle = invitation?.preferred_handle || null
          const result = await createAccountViaQuickLogin(
            ctx,
            jid,
            email,
            userName,
            preferredHandle,
          )

          did = result.did
          handle = result.handle
          accessJwt = result.accessJwt
          refreshJwt = result.refreshJwt

          // Mark the invitation as consumed
          if (invitation) {
            await ctx.invitationManager.consumeInvitation(email, did, handle)
            req.log.info(
              { email: ctx.invitationManager.hashEmail(email) },
              'Invitation consumed',
            )
          }
        } else {
          // Account exists - create the link
          req.log.info(
            { jid, email, did: existingAccount.did },
            'Creating Neuro identity link for existing account',
          )

          did = existingAccount.did
          handle = await getHandleForDid(ctx, did)

          // Create the neuro_identity_link
          await ctx.accountManager.db.db
            .insertInto('neuro_identity_link')
            .values({
              neuroJid: jid,
              did,
              email: email || null,
              userName: userName || null,
              linkedAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            })
            .execute()

          // Create session
          const tokens = await ctx.accountManager.createSession(
            did,
            null,
            false,
          )
          accessJwt = tokens.accessJwt
          refreshJwt = tokens.refreshJwt

          // Delete the invitation if it exists
          if (invitation) {
            await ctx.invitationManager.deleteInvitation(invitation.id)
            req.log.info(
              { email: ctx.invitationManager.hashEmail(email) },
              'Invitation consumed for existing account',
            )
          }
        }
      }

      // Update session with success
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'completed',
        result: {
          did,
          handle,
          accessJwt,
          refreshJwt,
          created: !existingLink,
        },
      })

      req.log.info(
        { sessionId: session.sessionId, did, handle },
        'QuickLogin completed successfully',
      )

      // Return success to provider
      return {
        encoding: 'application/json',
        body: { success: true },
      }
    },
  })
}
