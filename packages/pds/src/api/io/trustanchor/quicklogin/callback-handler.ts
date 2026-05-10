import { sql } from 'kysely'
import type { EmailTokenPurpose } from '../../../../account-manager/db'
import { AppContext } from '../../../../context'
import {
  NeuroCallbackPayload,
  createAccountViaQuickLogin,
  getHandleForDid,
  normalizeJid,
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
  'emailHash',
  'emailhash',
  'Signatures',
  'Randoms',
  'Properties',
  'Attachments',
])

const throwInvitationRequired = (message: string): never => {
  const err = new Error(message) as Error & { code: string }
  err.code = 'InvitationRequired'
  throw err
}

/**
 * Normalize domain by stripping resource identifier suffix
 * WID may send: domain/resourceId
 * We validate: domain
 */
const normalizeDomain = (domain: string): string => {
  const slashIndex = domain.indexOf('/')
  return slashIndex > 0 ? domain.substring(0, slashIndex) : domain
}

// Unused in JID-based flow but kept for backwards compatibility
const _extractEmailHash = (
  payload: NeuroCallbackPayload,
): string | undefined => {
  const direct = payload.emailHash || payload.emailhash
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim().toLowerCase()
  }

  const properties = payload.Properties
  if (!properties || typeof properties !== 'object') {
    return undefined
  }

  const raw =
    (properties as Record<string, unknown>).emailHash ||
    (properties as Record<string, unknown>).emailhash ||
    (properties as Record<string, unknown>).EMAIL_HASH

  return typeof raw === 'string' && raw.trim()
    ? raw.trim().toLowerCase()
    : undefined
}

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
 * WP5 — Test-User Login Policy:
 * - Controlled by PDS_ALLOW_TEST_USER_LOGIN (ctx.cfg.allowTestUserLogin)
 * - Default false: deny test-user login unless explicitly enabled
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
  // Normalize to strip any resource identifier suffix (e.g., user@domain/resourceId → user@domain)
  const rawJid = payload.JID
  if (!rawJid) {
    log.error({ payload }, 'JID missing from callback')
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'JID missing',
    })
    throw new Error('JID missing from callback')
  }
  const jid = normalizeJid(rawJid)

  // Validate Neuro server hostname against allowed suffixes (security check)
  // If suffixes configured: REQUIRED validation
  // If no suffixes configured: SKIP validation (development mode)
  // Normalize domain to strip any resource identifier suffix
  const rawDomain = payload.Domain
  const domain = rawDomain ? normalizeDomain(rawDomain) : undefined
  const allowedSuffixes = ctx.cfg.quicklogin?.hostnameSuffixes || []

  if (allowedSuffixes.length > 0) {
    // Hostname validation is enabled
    if (!domain) {
      log.error(
        { sessionId: session.sessionId },
        'Domain field missing from callback payload - rejecting for security',
      )
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'failed',
        error: 'Domain missing',
      })
      throw new Error('Domain field required in callback payload')
    }

    // Case-insensitive comparison
    const domainLower = domain.toLowerCase()
    const isAllowed = allowedSuffixes.some((suffix) =>
      domainLower.endsWith(suffix.toLowerCase()),
    )

    if (!isAllowed) {
      log.error(
        {
          sessionId: session.sessionId,
          domain,
          allowedSuffixes,
        },
        'Rejected callback from unauthorized Neuro server',
      )
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'failed',
        error: 'Unauthorized Neuro server',
      })
      throw new Error(`Unauthorized Neuro server: ${domain}`)
    }

    log.info(
      { sessionId: session.sessionId, domain },
      'Neuro server hostname validated',
    )
  } else {
    // No suffixes configured - skip validation (development mode)
    log.info(
      { sessionId: session.sessionId, domain: domain || 'not provided' },
      'Hostname validation skipped (no suffixes configured)',
    )
  }

  // WP1/WID protocol update: parse test-user status from explicit param only.
  // JID prefix 'test_' is no longer used as inference — accountType on actor
  // is the authoritative source; istestuser flag drives creation.
  const jidLocalPart = jid.split('@')[0] ?? ''
  const isTestUser =
    payload.istestuser === 'true'
      ? 1
      : payload.istestuser === 'false'
        ? 0
        : jidLocalPart.startsWith('test_')
          ? 1
          : 0

  // WP1: Parse preferred handle (optional, only for first create)
  const preferredHandle = payload.preferredhandle
  // emailHash no longer used for JID-based invitation flow

  if (isTestUser === 1 && !ctx.cfg.allowTestUserLogin) {
    log.info(
      { sessionId: session.sessionId },
      'Test user login denied by config',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'TestUserDenied',
    })
    throw new Error('Login to test accounts not allowed on this server')
  }

  // Branch: non-login approval sessions (delete_account, plc_operation)
  if (session.purpose && session.purpose !== 'login') {
    return handleApprovalCallback(session, jid, ctx, log)
  }

  log.info(
    { sessionId: session.sessionId },
    'QuickLogin: valid session with callback payload',
  )

  // WP3: Resolve links by pseudonymous JID (many-to-many, ordered by lastLoginAt DESC)
  const existingLinks = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .innerJoin('actor', 'actor.did', 'neuro_identity_link.did')
    .select([
      'neuro_identity_link.did',
      'neuro_identity_link.lastLoginAt',
      'actor.accountType',
    ])
    .where('neuro_identity_link.jid', '=', jid)
    .orderBy(
      sql<string>`COALESCE(neuro_identity_link.lastLoginAt, '1970-01-01T00:00:00.000Z')`,
      'desc',
    )
    .execute()

  let did: string
  let accessJwt: string
  let refreshJwt: string
  let handle: string
  let created = false

  if (existingLinks.length > 0) {
    // Existing links found - login with most-recently-used account
    const existingLink = existingLinks[0]
    log.info(
      { sessionId: session.sessionId },
      'Existing Neuro identity link found',
    )

    // Gate test-user login: check accountType on the actor
    if (existingLink.accountType === 'test' && !ctx.cfg.allowTestUserLogin) {
      log.info(
        { sessionId: session.sessionId },
        'Test user login denied by config (existing account)',
      )
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'failed',
        error: 'TestUserDenied',
      })
      throw new Error('Login to test accounts not allowed on this server')
    }

    did = existingLink.did
    handle = await getHandleForDid(ctx, did)

    // Update last login timestamp for this specific (jid, did) pair
    await ctx.accountManager.db.db
      .updateTable('neuro_identity_link')
      .set({ lastLoginAt: new Date().toISOString() })
      .where('jid', '=', jid)
      .where('did', '=', did)
      .execute()

    // Consume matching JID invitation if present (policy: always consume on login)
    await ctx.invitationManager.consumeInvitationByJid(jid, did, handle)

    // Mark WID inventory account as consumed
    try {
      await ctx.widInventoryManager.markAccountConsumed(jid)
    } catch (err) {
      // Log but don't fail - inventory tracking is non-critical
      log.warn(
        { jid: jid.substring(0, 8) + '...', error: (err as Error).message },
        'Failed to mark inventory account as consumed',
      )
    }

    // Create session
    const account = await ctx.accountManager.getAccount(did)
    if (!account) {
      log.error(
        { sessionId: session.sessionId },
        'Account not found for linked DID',
      )
      throw new Error('Account not found')
    }

    const tokens = await ctx.accountManager.createSession(did, null, false, jid)
    accessJwt = tokens.accessJwt
    refreshJwt = tokens.refreshJwt
  } else {
    // WP3: No existing link - atomically create account + link
    // Handle generation uses preferredHandle or fallback

    let invitePreferredHandle: string | null | undefined

    // Test-user bypass: isTestUser=1 accounts skip invitation requirements
    if (ctx.cfg.invites.required && isTestUser !== 1) {
      const invite = await ctx.invitationManager.getInvitationByJid(jid)
      if (!invite) {
        ctx.quickloginStore.updateSession(session.sessionId, {
          status: 'failed',
          error: 'InvitationRequired',
        })
        return throwInvitationRequired('No valid invitation found for this JID')
      }

      invitePreferredHandle = invite.preferred_handle
    }

    log.info(
      { sessionId: session.sessionId },
      'No existing link: creating new account',
    )

    try {
      const result = await createAccountViaQuickLogin(
        ctx,
        jid,
        isTestUser,
        preferredHandle || invitePreferredHandle || undefined,
        log,
        session.sessionId,
      )

      did = result.did
      handle = result.handle
      accessJwt = result.accessJwt
      refreshJwt = result.refreshJwt
      created = true

      // Consume invitation by JID (only matching JID row)
      await ctx.invitationManager.consumeInvitationByJid(jid, did, handle)

      // Mark WID inventory account as consumed
      try {
        await ctx.widInventoryManager.markAccountConsumed(jid)
      } catch (err) {
        // Log but don't fail - inventory tracking is non-critical
        log.warn(
          { jid: jid.substring(0, 8) + '...', error: (err as Error).message },
          'Failed to mark inventory account as consumed',
        )
      }

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
 * (delete_account, plc_operation, link_wid). Creates an internal email-style token
 * and stores it in the session for the client to retrieve via status polling.
 *
 * SECURITY: Verifies that the JID scanning the QR code matches the account owner's JID.
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

  // link_wid: upgrade an unverified account to a personal account.
  // No pre-existing link to verify JID against — the link is being CREATED here.
  if (purpose === 'link_wid') {
    log.info(
      { did: approvalDid, jid: jid.substring(0, 8) + '...' },
      'link_wid QR scanned — upgrading unverified account',
    )
    try {
      await ctx.accountManager.upgradeUnverifiedToPersonalAccount(
        jid,
        approvalDid,
      )
      // Issue fresh tokens so the client's session reflects the new accountType
      const tokens = await ctx.accountManager.createSession(
        approvalDid,
        null,
        false,
        jid,
      )
      const handle = await ctx.accountManager
        .getAccount(approvalDid)
        .then((a) => a?.handle ?? '')
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'completed',
        result: {
          did: approvalDid,
          handle,
          accessJwt: tokens.accessJwt,
          refreshJwt: tokens.refreshJwt,
          created: false,
        },
      })
      log.info({ did: approvalDid }, 'link_wid upgrade completed successfully')
    } catch (err) {
      const code = (err as any)?.error ?? (err as Error).message
      log.warn(
        { sessionId: session.sessionId, error: code },
        'link_wid upgrade failed',
      )
      ctx.quickloginStore.updateSession(session.sessionId, {
        status: 'failed',
        error: code,
      })
    }
    return
  }

  log.info(
    { purpose, did: approvalDid, jid: jid.substring(0, 8) + '...' },
    'WID approval QR scanned — verifying ownership',
  )

  // SECURITY FIX: Verify the JID scanning the QR code owns the account being approved
  // This prevents cross-account deletion/modification attacks
  const accountLink = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['jid'])
    .where('did', '=', approvalDid)
    .orderBy(
      sql<string>`COALESCE(neuro_identity_link.lastLoginAt, '1970-01-01T00:00:00.000Z')`,
      'desc',
    )
    .executeTakeFirst()

  if (!accountLink) {
    log.error(
      { sessionId: session.sessionId, did: approvalDid },
      'Account has no linked WID identity - cannot approve',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'Account has no linked WID identity',
    })
    throw new Error('Account has no linked WID identity')
  }

  const accountJid = accountLink.jid

  if (!accountJid) {
    log.error(
      { sessionId: session.sessionId, did: approvalDid },
      'Account link missing JID field',
    )
    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'Account link missing JID',
    })
    throw new Error('Account link missing JID field')
  }

  // Normalize both JIDs for comparison (strip resource identifiers)
  const normalizedAccountJid = normalizeJid(accountJid)
  const normalizedScannedJid = normalizeJid(jid)

  // CRITICAL SECURITY CHECK: JIDs must match
  if (normalizedAccountJid !== normalizedScannedJid) {
    log.warn(
      {
        sessionId: session.sessionId,
        purpose,
        approvalDid,
        expectedJid: normalizedAccountJid.substring(0, 8) + '...',
        receivedJid: normalizedScannedJid.substring(0, 8) + '...',
      },
      'JID mismatch: QR code must be scanned by account owner',
    )

    ctx.quickloginStore.updateSession(session.sessionId, {
      status: 'failed',
      error: 'JID mismatch: QR code must be scanned by account owner',
    })

    throw new Error('This QR code must be scanned by the account owner')
  }

  log.info(
    {
      purpose,
      did: approvalDid,
      jid: normalizedScannedJid.substring(0, 8) + '...',
    },
    'JID ownership verified — creating approval token',
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
