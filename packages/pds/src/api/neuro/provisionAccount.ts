import crypto from 'node:crypto'
import * as plc from '@did-plc/lib'
import { Router } from 'express'
import { AccountStatus } from '../../account-manager/account-manager'
import { setEmailConfirmedAt } from '../../account-manager/helpers/account'
import { AppContext } from '../../context'

export const createProvisionAccountRoute = (ctx: AppContext): Router => {
  const router = Router()

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

    req.log.info({ legalId: payload.Object }, 'Processing approved Legal ID')

    // Step 2: Extract and validate required fields from LegalIdUpdated (Approved)
    const legalId = payload.Tags?.ID
    const userName = payload.Tags?.Account?.toLowerCase() // Lowercase for Caddy validation
    const timestamp = payload.Timestamp
    const emailFromNeuro = payload.Tags?.EMAIL?.trim()
    const phone = payload.Tags?.PHONE?.trim()
    const jidRef = payload.Tags?.JID // For reference only
    // eventId and state already extracted in Step 1
    const object = payload.Object
    const actor = payload.Actor || ''

    if (!legalId || !userName || !timestamp) {
      return res.status(400).json({
        error: 'InvalidRequest',
        message: 'Missing required fields: Tags.ID, Tags.Account, Timestamp',
      })
    }

    // Step 3: Validate Legal ID format (uuid@legal.domain)
    if (!legalId.includes('@legal.')) {
      return res.status(400).json({
        error: 'InvalidLegalId',
        message: 'Tags.ID must be in format uuid@legal.domain',
      })
    }

    // Step 4: Convert timestamp and validate (within 10 minutes)
    const requestTime = timestamp * 1000 // Convert Unix epoch to ms
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000 // Increased for network delays
    if (Math.abs(now - requestTime) > tenMinutes) {
      return res.status(400).json({
        error: 'RequestExpired',
        message: 'Timestamp is too old or too far in the future',
      })
    }

    // Step 5: Generate composite nonce from event fields
    // ApiKey is NOT unique per event, timestamp has 1s resolution
    // Solution: Hash of event-identifying fields
    const nonceInput = `${eventId}:${timestamp}:${object}:${actor}`
    const nonce = crypto.createHash('sha256').update(nonceInput).digest('hex')

    // Step 6: Handle email (use Neuro's email or fallback to noreply)
    const email = emailFromNeuro || 'noreply@wsocial.eu'

    req.log.info(
      {
        legalId,
        userName,
        email,
        emailFromNeuro: !!emailFromNeuro,
        phone,
        jidRef,
        country: payload.Tags?.COUNTRY,
        nonce,
        eventId,
        timestamp,
        object,
        actor,
        state,
      },
      'Received LegalIdUpdated (Approved) - provisioning account',
    )

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

    // Step 8: Check if Legal ID already linked (before any provisioning)
    const existingLink = await ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .select(['did', 'neuroJid'])
      .where('neuroJid', '=', legalId)
      .executeTakeFirst()

    if (existingLink) {
      req.log.info(
        { legalId, did: existingLink.did },
        'Account already provisioned for this Legal ID',
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
    // Format: john → john_3 → john_39 → john_391 (keep appending until available)
    let handle = `${userName}.${ctx.cfg.service.hostname}`
    let handleAcct = await ctx.accountManager.getAccount(handle)
    let suffix = ''

    while (handleAcct) {
      // Handle taken, append random digit
      const randomDigit = Math.floor(Math.random() * 10)
      suffix += randomDigit
      handle = `${userName}_${suffix}.${ctx.cfg.service.hostname}`
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

        // Step 12: Link Neuro identity
        await ctx.neuroAuthManager!.linkIdentity(legalId, did, email, userName)

        // Step 13: Sequence events
        await ctx.sequencer.sequenceIdentityEvt(did, handle)
        await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
        await ctx.sequencer.sequenceCommit(did, commit)

        // Step 14: Store nonce AFTER successful account creation
        // This allows retry if provisioning failed earlier
        await ctx.accountManager.db.db
          .insertInto('neuro_provision_nonce')
          .values({
            nonce,
            legalId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
          })
          .execute()

        accountCreated = true
        req.log.info(
          { did, handle, legalId },
          'Account auto-provisioned successfully',
        )

        // Mark email as verified since Neuro already verified it during Legal ID approval
        if (emailFromNeuro && email) {
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
          handle = `${userName}_${suffix}.${ctx.cfg.service.hostname}`
          req.log.warn(
            {
              previousHandle: `${userName}_${suffix.slice(0, -1)}.${ctx.cfg.service.hostname}`,
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
