import { Router } from 'express'
import { AppContext } from '../../../../context'
import {
  NeuroCallbackPayload,
  createAccountViaQuickLogin,
  deriveAvailableHandle,
  extractEmail,
  extractUserName,
  getHandleForDid,
} from './helpers'

export function callbackQuickLogin(router: Router, ctx: AppContext) {
  router.post('/xrpc/io.trustanchor.quicklogin.callback', async (req, res) => {
    try {
      if (!ctx.cfg.quicklogin) {
        return res.status(400).json({ error: 'QuickLogin not enabled' })
      }

      const payload = req.body as NeuroCallbackPayload

      req.log.info(
        {
          sessionId: payload.SessionId,
          key: payload.Key,
          state: payload.State,
        },
        'QuickLogin callback received',
      )

      // The provider sends back its own SessionId, but we need to look up by Key (serviceId)
      const serviceId = payload.Key
      if (!serviceId) {
        req.log.warn({ payload }, 'Missing Key/serviceId in callback')
        return res.status(400).json({ error: 'Missing Key' })
      }

      // Find session by serviceId
      const session = ctx.quickloginStore.getSessionByServiceId(serviceId)
      if (!session) {
        req.log.warn({ serviceId }, 'Session not found for serviceId')
        return res.status(404).json({ error: 'Session not found' })
      }

      // Check if session expired
      if (new Date() > new Date(session.expiresAt)) {
        req.log.warn({ sessionId: payload.SessionId }, 'Session expired')
        return res.status(400).json({ error: 'Session expired' })
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
        return res.status(400).json({ error: `QuickLogin ${payload.State}` })
      }

      // Extract JID from payload
      const jid = payload.JID
      if (!jid) {
        req.log.error({ payload }, 'JID missing from callback')
        ctx.quickloginStore.updateSession(session.sessionId, {
          status: 'failed',
          error: 'JID missing',
        })
        return res.status(400).json({ error: 'JID missing from callback' })
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
        // Existing user - create session
        req.log.info(
          { jid, did: existingLink.did },
          'Existing Neuro identity found',
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
          return res.status(500).json({ error: 'Account not found' })
        }

        const tokens = await ctx.accountManager.createSession(did, null, false)
        accessJwt = tokens.accessJwt
        refreshJwt = tokens.refreshJwt
      } else {
        // New user - check if account creation allowed
        if (!session.allowCreate) {
          req.log.warn({ jid }, 'Account creation not allowed for this session')
          ctx.quickloginStore.updateSession(session.sessionId, {
            status: 'failed',
            error: 'Account creation not allowed',
          })
          return res.status(400).json({ error: 'Account creation not allowed' })
        }

        req.log.info({ jid }, 'Creating new account for Neuro identity')

        // Extract metadata
        const email = extractEmail(payload.Properties)
        const userName = extractUserName(payload.Properties)

        // Derive handle
        const derivedHandle = await deriveAvailableHandle(ctx, email)

        // Create account
        const result = await createAccountViaQuickLogin(ctx, {
          handle: derivedHandle,
          neuroJid: jid,
          email,
          userName,
        })

        did = result.did
        handle = result.handle
        accessJwt = result.accessJwt
        refreshJwt = result.refreshJwt
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
      return res.json({ success: true })
    } catch (error) {
      req.log.error({ error }, 'QuickLogin callback failed')
      return res.status(500).json({ error: 'Internal server error' })
    }
  })
}
