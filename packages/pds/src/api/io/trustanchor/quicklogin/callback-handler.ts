import type { EmailTokenPurpose } from '../../../../account-manager/db'
import { AppContext } from '../../../../context'
import {
  NeuroCallbackPayload,
  createAccountViaQuickLogin,
  getHandleForDid,
} from './helpers'
import type { QuickLoginSession } from './store'

export interface CallbackResult {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  created: boolean
}

export interface Logger {
  info(obj: any, msg: string): void
  warn(obj: any, msg: string): void
  error(obj: any, msg: string): void
}

const EXPECTED_CALLBACK_FIELDS = new Set([
  'JID',
  'Key',
  'SessionId',
  'State',
  'istestuser',
  'preferredhandle',
  'Signatures',
  'Randoms',
  'Properties',
  'Attachments',
])

/**
 * Unified QuickLogin callback handler (both account creation and login).
 * Privacy-separated: PDS receives only pseudonymous JID + test marker.
 * WP1 — Protocol Parsing & Defaults:
 * - Parse istestuser as case-sensitive string ("true"/"false", missing = non-test)
 * - Parse preferredhandle (optional, for first create only)
 *
 * WP3 — Atomic Account/Link Logic:
 * - Existing link: return login with updated lastLoginAt
 * - New link: atomically create account + link in single transaction
 * - Race safety: unique constraints on (userJid, isTestUser=0) and (testUserJid, isTestUser=1)
 *
 * WP4 — Handle Generation Policy:
 * - Use preferredhandle if provided and available
 * - Fallback: auto<1-10 digit suffix>.hostname
 * - Ignore preferredhandle for existing accounts
 *
 * WP5 — Test-User Environment Policy:
 * - Production: deny with "Login to test accounts not allowed on this server"
 * - Non-prod: allow test-user login
 *
 * WP6 — Pseudonymous-only Logging:
 * - Log sessionId, callback accept/reject, created vs login
 * - Never log JID, test status, or other identity fields
 *
 * WP2 (deferred):
 * - Callback signature verification (feature-flagged, pending Neuro contract)
 */
export async function handleQuickLoginCallback(
  payload: NeuroCallbackPayload,
  ctx: AppContext,
  log: Logger,
): Promise<CallbackResult | void> {
  const callbackPayload = payload as Record<string, unknown>
  const receivedFieldNames = Object.keys(callbackPayload).sort()
  const unexpectedFieldNames = receivedFieldNames.filter(
    (fieldName) => !EXPECTED_CALLBACK_FIELDS.has(fieldName),
  )

  if (ctx.cfg.debugNeuro) {
    log.info(
      {
        payload: callbackPayload,
        receivedFieldNames,
        unexpectedFieldNames,
      },
      'QuickLogin callback payload received (debug)',
    )
  }

  log.info(
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
    log.warn({ payload }, 'Missing Key/serviceId in callback')
    throw new Error('Missing Key')
  }

  // Find session by serviceId
  const session = ctx.quickloginStore.getSessionByServiceId(serviceId)
  if (!session) {
    log.warn({ serviceId }, 'Session not found for serviceId')
    throw new Error('Session not found')
  }

  if (ctx.cfg.debugNeuro) {
    ctx.quickloginStore.updateSession(session.sessionId, {
      debugNeuro: {
        callbackPayload,
        receivedFieldNames,
        unexpectedFieldNames,
      },
    })
  }

  // Check if session expired
  if (new Date() > new Date(session.expiresAt)) {
    log.warn({ sessionId: payload.SessionId }, 'Session expired')
    throw new Error('Session expired')
  }

  // Validate state (mTLS handles transport security; signature verification deferred WP2)
  if (payload.State !== 'Approved') {
    log.info(
      { sessionId: session.sessionId, state: payload.State },
      'QuickLogin not approved',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: `QuickLogin ${payload.State}`,
    })
    throw new Error(`QuickLogin ${payload.State}`)
  }

  // WP1: Parse JID from payload (required, pseudonymous lookup key)
  const jid = payload.JID
  if (!jid) {
    log.error({ payload }, 'JID missing from callback')
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'JID missing',
    })
    throw new Error('JID missing from callback')
  }

  // WP1: Parse test-user status from callback
  const isTestUser = payload.istestuser === 'true' ? 1 : 0

  // WP1: Parse preferred handle (optional, only for first create)
  const preferredHandle = payload.preferredhandle

  // Branch: non-login approval sessions (delete_account, plc_operation)
  if (session.purpose && session.purpose !== 'login') {
    return handleApprovalCallback(session, jid, ctx, log)
  }

  log.info(
    { sessionId: session.sessionId },
    'QuickLogin: valid session with callback payload',
  )

  // WP3: Resolve link by pseudonymous JID key (privacy-separated)
  // Real users: lookup by userJid (isTestUser=0)
  // Test users: lookup by testUserJid (isTestUser=1)
  const existingLink = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .selectAll()
    .where(isTestUser === 1 ? 'testUserJid' : 'userJid', '=', jid)
    .where('isTestUser', '=', isTestUser)
    .executeTakeFirst()

  let did: string
  let accessJwt: string
  let refreshJwt: string
  let handle: string
  let created = false

  if (existingLink) {
    // WP5: Test-user environment policy
    if (isTestUser === 1 && ctx.cfg.service.hostname !== 'localhost') {
      // Production server: deny test-user login
      const isProdLike =
        ctx.cfg.service.hostname.includes('prod') ||
        ctx.cfg.service.hostname.includes('live')
      if (isProdLike || !ctx.cfg.service.devMode) {
        log.info(
          { sessionId: session.sessionId },
          'Test user login denied on production',
        )
        ctx.quickloginStore.updateSession(session.sessionId, {
          status: 'failed',
          error: 'TestUserDenied',
        })
        throw new Error('Login to test accounts not allowed on this server')
      }
    }

    // Existing link - login with existing account
    log.info(
      { sessionId: session.sessionId },
      'Existing Neuro identity link found',
    )

    did = existingLink.did
    handle = await getHandleForDid(ctx, did)

    // Update last login timestamp
    await ctx.accountManager.db.db
      .updateTable('neuro_identity_link')
      .set({ lastLoginAt: new Date().toISOString() })
      .where('did', '=', did)
      .execute()

    // Create session
    const account = await ctx.accountManager.getAccount(did)
    if (!account) {
      log.error(
        { sessionId: session.sessionId },
        'Account not found for linked DID',
      )
      throw new Error('Account not found')
    }

    const tokens = await ctx.accountManager.createSession(did, null, false)
    accessJwt = tokens.accessJwt
    refreshJwt = tokens.refreshJwt
  } else {
    // WP3: No existing link - atomically create account + link
    // Invitations no longer required (enforcement moved to WID)
    // Handle generation uses preferredHandle or fallback

    log.info(
      { sessionId: session.sessionId },
      'No existing link: creating new account',
    )

    try {
      const result = await createAccountViaQuickLogin(
        ctx,
        jid,
        isTestUser,
        preferredHandle || undefined,
        log,
        session.sessionId,
      )

      did = result.did
      handle = result.handle
      accessJwt = result.accessJwt
      refreshJwt = result.refreshJwt
      created = true

      log.info(
        { sessionId: session.sessionId },
        'New account created via QuickLogin',
      )
    } catch (err) {
      log.error(
        { sessionId: session.sessionId, error: (err as Error).message },
        'Account creation failed',
      )
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'failed',
        error: 'AccountCreationFailed',
      })
      throw err
    }
  }

  // Update session with success (WP6: pseudonymous logging only)
  ctx.quickloginStore.updateSession(session.sessionId, {
    status: 'completed',
    result: {
      did,
      handle,
      accessJwt,
      refreshJwt,
      created,
    },
  })

  log.info(
    { sessionId: session.sessionId, created },
    'QuickLogin completed successfully',
  )

  return {
    did,
    handle,
    accessJwt,
    refreshJwt,
    created,
  }
}

/**
 * Handle a QuickLogin callback for a non-login approval session
 * (delete_account, plc_operation). Creates an internal email-style token
 * and stores it in the session for the client to retrieve via status polling.
 */
async function handleApprovalCallback(
  session: QuickLoginSession,
  jid: string,
  ctx: AppContext,
  log: Logger,
): Promise<void> {
  const { purpose, approvalDid } = session

  if (!approvalDid) {
    log.error(
      { sessionId: session.sessionId },
      'Approval session missing approvalDid',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'Approval session missing DID',
    })
    return
  }

  log.info(
    { purpose, did: approvalDid, jid },
    'WID approval QR scanned — creating token',
  )

  try {
    const token = await ctx.accountManager.createEmailToken(
      approvalDid,
      purpose as EmailTokenPurpose,
    )

    log.info(
      { purpose, did: approvalDid },
      'WID approval token created successfully',
    )

    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'completed',
      approvalToken: token,
    })
  } catch (err) {
    log.error(
      { err, purpose, did: approvalDid },
      'Failed to create approval token',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'Failed to create approval token',
    })
  }
}
