import crypto from 'node:crypto'
import * as plc from '@did-plc/lib'
import { Router } from 'express'
import { AccountStatus } from '../../account-manager/account-manager'
import { setEmailConfirmedAt } from '../../account-manager/helpers/account'
import { AppContext } from '../../context'

export const createProvisionAccountRoute = (ctx: AppContext): Router => {
  const router = Router()

  /**
   * POST /neuro/provision/account
   *
   * Handles W ID onboarding events from Neuro server.
   *
   * Event Types:
   * 1. UserInvitation: Creates invitation records for users
   * 2. LegalIdUpdated (Approved): Auto-creates account for approved users
   *
   * Account Creation Behavior (LegalIdUpdated with State=Approved):
   * - Creates "zombie account" WITHOUT checking invitation status
   * - Zombie account: account exists but user cannot login until invitation issued
   * - This allows users to complete expensive W ID onboarding once
   * - If invitation becomes available later, user can login without re-onboarding
   * - Admin can create invitation via UserInvitation event to unblock account
   *
   * Why this design:
   * - W ID onboarding is time-consuming and expensive for users
   * - Invitation requirement is enforced at login time (QuickLogin)
   * - If user doesn't have invitation, they get clear error but don't lose onboarding progress
   * - Admin can retroactively create invitation to grant access
   *
   * Authentication:
   * - Requires X-API-Key header OR Basic Auth (admin:password)
   * - Both UserInvitation and LegalIdUpdated events require authentication
   *
   * Real vs Test Users:
   * - Real users: Must have all PII fields (FIRST, LAST, PNR, PHONE, COUNTRY)
   * - Test users: Have JID but no EMAIL field, requires PDS_ALLOW_TEST_USER_CREATION
   */
  router.post('/neuro/provision/account', async (req, res) => {
    const payload = req.body
    const eventId = payload.EventId
    const state = payload.Tags?.State

    // Handle UserInvitation events (invitation system)
    if (eventId === 'UserInvitation') {
      req.log.info({ invitation: payload }, 'Processing UserInvitation event')

      // Step 1: Validate admin authentication
      // Support two methods:
      // 1. X-API-Key header with admin password
      // 2. Basic Auth with username 'admin' and admin password

      const apiKey = req.headers['x-api-key'] as string
      const adminPassword = process.env.PDS_ADMIN_PASSWORD

      let authenticated = false

      // Method 1: Check X-API-Key header
      if (apiKey && adminPassword && apiKey === adminPassword) {
        authenticated = true
        req.log.debug('Authenticated via X-API-Key header')
      }

      // Method 2: Check Basic Auth
      if (!authenticated) {
        try {
          await ctx.authVerifier.adminToken({
            req,
            res,
            params: {},
          })
          authenticated = true
          req.log.debug('Authenticated via Basic Auth')
        } catch (err) {
          // Not authenticated via Basic Auth, will check below
        }
      }

      if (!authenticated) {
        req.log.warn('Unauthorized UserInvitation request - invalid auth')
        return res.status(401).json({
          error: 'Unauthorized',
          message:
            'Admin authentication required. Use X-API-Key header or Basic Auth.',
        })
      }

      // Step 2: Extract and validate required fields
      const email = payload.Tags?.EMAIL?.trim()
      if (!email) {
        return res.status(400).json({
          error: 'InvalidRequest',
          message: 'Missing required field: Tags.EMAIL',
        })
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'InvalidEmail',
          message: 'Tags.EMAIL must be a valid email address',
        })
      }

      // Step 3: Extract optional preferred handle from Handle field
      const preferredHandle = payload.Handle?.trim() || null

      // Step 4: Extract timestamp (required)
      const timestamp = payload.Timestamp
      if (!timestamp) {
        return res.status(400).json({
          error: 'InvalidRequest',
          message: 'Missing required field: Timestamp',
        })
      }

      // Step 5: Create or update invitation
      try {
        await ctx.invitationManager.createInvitation(
          email,
          preferredHandle,
          timestamp,
        )

        req.log.info(
          { email: ctx.invitationManager.hashEmail(email), preferredHandle },
          'Invitation created successfully',
        )

        return res.status(201).json({
          success: true,
          message: 'Invitation created',
          email,
          preferredHandle,
        })
      } catch (err) {
        req.log.error({ error: err, email }, 'Failed to create invitation')
        return res.status(500).json({
          error: 'InvitationFailed',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // Step 1: Filter events - only process LegalIdUpdated with State=Approved
    if (eventId === 'AccountCreated') {
      req.log.debug(
        { account: payload.Object },
        'AccountCreated event - not relevant',
      )
      return res.status(200).json({
        message: 'AccountCreated acknowledged',
      })
    }

    if (eventId === 'LegalIdRegistered') {
      req.log.debug(
        { legalId: payload.Object, state },
        'LegalIdRegistered event - not approved yet',
      )
      return res.status(200).json({
        message: 'LegalIdRegistered acknowledged, waiting for approval',
      })
    }

    if (eventId === 'LegalIdUpdated' && state !== 'Approved') {
      req.log.info(
        { legalId: payload.Object, state },
        'LegalIdUpdated with non-Approved state - ignoring',
      )
      return res.status(200).json({
        message: `Legal ID state is ${state}, not Approved`,
      })
    }

    if (eventId !== 'LegalIdUpdated') {
      req.log.debug({ eventId }, 'Ignoring unknown event type')
      return res.status(200).json({
        message: `Event ${eventId} not relevant for provisioning`,
      })
    }

    // At this point: eventId === 'LegalIdUpdated' && state === 'Approved'

    // Step 2: Detect user type - test users have Legal ID but NO EMAIL
    // Real users: Have Legal ID AND have EMAIL field
    // Test users: Have Legal ID but EMAIL field is missing or empty
    const emailFromTags = payload.Tags?.EMAIL
    const isTestUser = !emailFromTags || emailFromTags.trim() === ''

    const timestamp = payload.Timestamp
    const object = payload.Object
    const actor = payload.Actor || ''

    // Common: validate timestamp
    if (!timestamp) {
      return res.status(400).json({
        error: 'InvalidRequest',
        message: 'Missing required field: Timestamp',
      })
    }

    // === SEPARATE PATHS FOR TEST USERS vs REAL USERS ===

    if (isTestUser) {
      // ============================================================
      // TEST USER PATH: Simpler validation, no PII requirements
      // ============================================================

      req.log.info(
        { object, tags: payload.Tags },
        'Processing test user (no EMAIL field)',
      )

      // Validate test user required fields
      const jidRef = payload.Tags?.JID
      const userName = payload.Tags?.Account?.toLowerCase()

      if (!jidRef || !userName) {
        return res.status(400).json({
          error: 'InvalidRequest',
          message: 'Test users require: Tags.JID, Tags.Account',
        })
      }

      // Check if test user creation is allowed
      if (!ctx.cfg.allowTestUserLogin) {
        req.log.warn(
          { jid: jidRef, userName },
          'Test user provisioning rejected - PDS_ALLOW_TEST_USER_CREATION=false',
        )
        return res.status(403).json({
          error: 'TestUserCreationDisabled',
          message: 'Test user creation is disabled on this server',
        })
      }

      // Convert timestamp and validate (within 10 minutes)
      const requestTime = timestamp * 1000
      const now = Date.now()
      const tenMinutes = 10 * 60 * 1000
      if (Math.abs(now - requestTime) > tenMinutes) {
        return res.status(400).json({
          error: 'RequestExpired',
          message: 'Timestamp is too old or too far in the future',
        })
      }

      // Generate nonce for test user
      const nonceInput = `${eventId}:${timestamp}:${object}:${actor}`
      const nonce = crypto.createHash('sha256').update(nonceInput).digest('hex')

      req.log.info(
        {
          jid: jidRef,
          userName,
          isTestUser: true,
          nonce,
          eventId,
          timestamp,
          object,
          actor,
          state,
          tags: payload.Tags,
        },
        'Test user validation passed - proceeding to provision',
      )

      // Continue with test user provisioning below (after real user path)
    } else {
      // ============================================================
      // REAL USER PATH: Strict validation, all PII fields required
      // ============================================================

      req.log.info({ legalId: object }, 'Processing real user (has Legal ID)')

      // Extract all required fields for real users
      const legalId = payload.Tags?.ID
      const userName = payload.Tags?.Account?.toLowerCase()
      const firstName = payload.Tags?.FIRST
      const lastName = payload.Tags?.LAST
      const pnr = payload.Tags?.PNR
      const email = payload.Tags?.EMAIL
      const phone = payload.Tags?.PHONE
      const country = payload.Tags?.COUNTRY
      const jidRef = payload.Tags?.JID

      // Validate ALL required fields are PRESENT (values can be empty/redacted)
      const requiredFields = {
        'Tags.ID': legalId,
        'Tags.Account': userName,
        'Tags.FIRST': firstName,
        'Tags.LAST': lastName,
        'Tags.PNR': pnr,
        'Tags.EMAIL': email,
        'Tags.PHONE': phone,
        'Tags.COUNTRY': country,
      }

      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => value === undefined)
        .map(([key]) => key)

      if (missingFields.length > 0) {
        req.log.warn(
          { legalId: object, missingFields, tags: payload.Tags },
          'Real user missing required fields - rejecting',
        )
        return res.status(400).json({
          error: 'MissingRequiredFields',
          message: `Real users require all fields (even if redacted): ${missingFields.join(', ')}`,
          missingFields,
        })
      }

      // Validate Legal ID format (uuid@legal.domain)
      if (!legalId || !legalId.includes('@legal.')) {
        return res.status(400).json({
          error: 'InvalidLegalId',
          message: 'Tags.ID must be in format uuid@legal.domain',
        })
      }

      // Convert timestamp and validate (within 10 minutes)
      const requestTime = timestamp * 1000
      const now = Date.now()
      const tenMinutes = 10 * 60 * 1000
      if (Math.abs(now - requestTime) > tenMinutes) {
        return res.status(400).json({
          error: 'RequestExpired',
          message: 'Timestamp is too old or too far in the future',
        })
      }

      // Generate nonce for real user
      const nonceInput = `${eventId}:${timestamp}:${object}:${actor}`
      const nonce = crypto.createHash('sha256').update(nonceInput).digest('hex')

      req.log.info(
        {
          legalId,
          userName,
          firstName,
          lastName,
          pnr,
          email,
          phone,
          country,
          jidRef,
          isTestUser: false,
          nonce,
          eventId,
          timestamp,
          object,
          actor,
          state,
          tags: payload.Tags,
        },
        'Real user validation passed - proceeding to provision',
      )

      // Continue with real user provisioning below
    }

    // ============================================================
    // COMMON PROVISIONING LOGIC (after validation)
    // ============================================================

    // Variables are already extracted in the paths above
    // Re-declare for TypeScript (values set in if/else above)
    const legalId: string | undefined = isTestUser
      ? undefined
      : payload.Tags?.ID
    const userName: string = (payload.Tags?.Account || '').toLowerCase()
    const jidRef: string | undefined = payload.Tags?.JID
    const emailFromNeuro: string | undefined = isTestUser
      ? undefined
      : payload.Tags?.EMAIL?.trim()
    const email: string = isTestUser
      ? 'noreply@wsocial.eu'
      : emailFromNeuro || 'noreply@wsocial.eu'

    // Nonce already generated in paths above, re-generate for common code
    const nonceInput = `${eventId}:${timestamp}:${object}:${actor}`
    const nonce = crypto.createHash('sha256').update(nonceInput).digest('hex')

    // Step 7: Check for nonce reuse (replay protection)
    const nonceExists = await ctx.accountManager.db.db
      .selectFrom('neuro_provision_nonce')
      .select(['nonce'])
      .where('nonce', '=', nonce)
      .executeTakeFirst()

    if (nonceExists) {
      req.log.warn({ nonce, legalId }, 'Nonce reused - duplicate event')
      return res.status(400).json({
        error: 'NonceReused',
        message: 'This event has already been processed',
      })
    }

    // Step 8: Check if identity already linked (real: userJid, test: testUserJid)
    let existingLink:
      | { did: string; userJid: string | null; testUserJid: string | null }
      | undefined

    if (isTestUser && jidRef) {
      // For test users, check JID
      existingLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'userJid', 'testUserJid'])
        .where('testUserJid', '=', jidRef)
        .where('isTestUser', '=', 1)
        .executeTakeFirst()
    } else if (!isTestUser && legalId) {
      // For real users, check Legal ID
      existingLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'userJid', 'testUserJid'])
        .where('userJid', '=', legalId)
        .where('isTestUser', '=', 0)
        .executeTakeFirst()
    }

    if (existingLink) {
      req.log.info(
        { legalId, jid: jidRef, did: existingLink.did, isTestUser },
        'Account already provisioned for this identity',
      )

      // Idempotent: return existing account info
      const account = await ctx.accountManager.getAccount(existingLink.did)
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        did: existingLink.did,
        handle: account?.handle || null,
        legalId,
      })
    }

    // Step 9: Validate email not already taken (skip for noreply address)
    if (email !== 'noreply@wsocial.eu') {
      const emailAcct = await ctx.accountManager.getAccount(email)
      if (emailAcct) {
        return res.status(409).json({
          error: 'EmailTaken',
          message: 'This email is already associated with another account',
        })
      }
    }

    // Step 10: Generate initial handle (may need retry if race condition occurs)
    // Use configured public handle domain (strip leading dot) and fallback to service hostname
    const handleDomain = (
      ctx.cfg.identity.serviceHandleDomains?.[0] || ctx.cfg.service.hostname
    ).replace(/^\./, '')
    // Format: john → john_3 → john_39 → john_391 (keep appending until available)
    let handle = `${userName}.${handleDomain}`
    let handleAcct = await ctx.accountManager.getAccount(handle)
    let suffix = ''

    while (handleAcct) {
      // Handle taken, append random digit
      const randomDigit = Math.floor(Math.random() * 10)
      suffix += randomDigit
      handle = `${userName}_${suffix}.${handleDomain}`
      handleAcct = await ctx.accountManager.getAccount(handle)

      // Safety: prevent infinite loop (extremely unlikely)
      if (suffix.length > 10) {
        req.log.error(
          { userName, suffix },
          'Unable to generate unique handle after 10 attempts',
        )
        return res.status(500).json({
          error: 'HandleGenerationFailed',
          message: 'Unable to generate unique handle',
        })
      }
    }

    req.log.info(
      { legalId, email, handle, userName },
      'Auto-provisioning account from Neuro',
    )

    // Step 11: Create account with retry logic for handle conflicts
    let accountCreated = false
    let retryCount = 0
    const maxRetries = 5
    let did: string

    while (!accountCreated && retryCount < maxRetries) {
      try {
        // Create signing key
        const signingKey = await ctx.actorStore.reserveKeypair()
        const keypair = await ctx.actorStore.getReservedKeypair(signingKey)
        if (!keypair) {
          throw new Error('Failed to reserve keypair')
        }

        // Create PLC operation
        const rotationKeys = [ctx.plcRotationKey.did()]
        if (ctx.cfg.identity.recoveryDidKey) {
          rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
        }

        const plcCreate = await plc.createOp({
          signingKey: keypair.did(),
          rotationKeys,
          handle,
          pds: ctx.cfg.service.publicUrl,
          signer: ctx.plcRotationKey,
        })

        did = plcCreate.did

        await ctx.actorStore.create(did, keypair)

        const commit = await ctx.actorStore.transact(did, (actorTxn) =>
          actorTxn.repo.createRepo([]),
        )

        // Send PLC operation
        try {
          await ctx.plcClient.sendOperation(did, plcCreate.op)
        } catch (err) {
          req.log.error(
            { didKey: ctx.plcRotationKey.did(), handle },
            'Failed to create did:plc',
          )
          throw err
        }

        // Create account with Legal ID as "password"
        await ctx.accountManager.createAccount({
          did,
          handle,
          email,
          password: legalId, // Store Legal ID as password hash
          repoCid: commit.cid,
          repoRev: commit.rev,
        })

        // Step 12: Link Neuro identity (test users use testUserJid, real users use userJid)
        await ctx.accountManager.db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid: isTestUser ? null : legalId, // NULL for test users
            testUserJid: isTestUser ? jidRef : null, // JID for test users, NULL for real users
            isTestUser: isTestUser ? 1 : 0, // 1 for test users, 0 for real users
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute()

        req.log.info(
          {
            did,
            userJid: isTestUser ? null : legalId,
            testUserJid: isTestUser ? jidRef : null,
            isTestUser,
          },
          'Neuro identity link created',
        )

        // Step 13: Sequence events
        await ctx.sequencer.sequenceIdentityEvt(did, handle)
        await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
        await ctx.sequencer.sequenceCommit(did, commit)

        // Step 14: Store nonce AFTER successful account creation
        // This allows retry if provisioning failed earlier
        // For test users, store JID in legalId column (since legalId is NOT NULL)
        await ctx.accountManager.db.db
          .insertInto('neuro_provision_nonce')
          .values({
            nonce,
            legalId: legalId || jidRef || 'unknown', // Use legalId for real users, JID for test users
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
          })
          .execute()

        accountCreated = true
        req.log.info(
          {
            did,
            handle,
            legalId: legalId || null,
            jid: isTestUser ? jidRef : null,
            isTestUser,
          },
          'Account auto-provisioned successfully',
        )

        // Mark email as verified since Neuro already verified it during Legal ID approval
        // Only for real users with actual email
        if (
          !isTestUser &&
          emailFromNeuro &&
          email &&
          email !== 'noreply@wsocial.eu'
        ) {
          await setEmailConfirmedAt(
            ctx.accountManager.db,
            did,
            new Date().toISOString(),
          )
          req.log.info(
            { did, email },
            'Email marked as verified (verified by Neuro)',
          )
        }

        return res.status(201).json({
          success: true,
          did,
          handle,
          legalId,
        })
      } catch (err) {
        // Log full error for debugging
        req.log.error(
          {
            error: err,
            errorType: err instanceof Error ? err.constructor.name : typeof err,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
          },
          'Account creation failed',
        )

        // Check error type
        const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
        const errorType =
          err instanceof Error ? err.constructor.name : typeof err
        const errorStack = err instanceof Error ? err.stack : String(err)

        // Handle specific error cases
        const isUserExists =
          errorType === 'UserAlreadyExistsError' ||
          errorMsg.includes('already exists')
        const isHandleConflict =
          errorMsg.includes('handle') ||
          errorMsg.includes('unique') ||
          errorMsg.includes('constraint')

        // Case 1: User/email already exists
        if (isUserExists) {
          req.log.warn(
            {
              legalId,
              email,
              errorType,
            },
            'Account with this email already exists - skipping provisioning',
          )

          return res.status(409).json({
            error: 'AccountExists',
            message: 'Account with this email already exists',
          })
        }

        // Case 2: Handle conflict - retry
        if (isHandleConflict && retryCount < maxRetries - 1) {
          retryCount++
          const randomDigit = Math.floor(Math.random() * 10)
          suffix += randomDigit
          handle = `${userName}_${suffix}.${handleDomain}`
          req.log.warn(
            {
              previousHandle: `${userName}_${suffix.slice(0, -1)}.${handleDomain}`,
              newHandle: handle,
              retryCount,
              error: errorMsg,
            },
            'Handle conflict during creation, retrying with new suffix',
          )
          continue // Retry with new handle
        }

        // Case 3: Other errors or max retries reached
        req.log.error(
          {
            error: errorMsg,
            errorType,
            stack: errorStack,
            legalId,
            email,
            handle,
            retryCount,
          },
          'Failed to provision account',
        )
        return res.status(500).json({
          error: 'ProvisionFailed',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // If we get here, max retries exceeded
    req.log.error(
      { legalId, userName, retryCount },
      'Max retries exceeded for handle generation',
    )
    return res.status(500).json({
      error: 'ProvisionFailed',
      message: 'Unable to generate unique handle after multiple attempts',
    })
  })

  return router
}
