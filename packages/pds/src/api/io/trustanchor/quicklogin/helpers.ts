import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { isValidTld } from '@atproto/syntax'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import {
  baseNormalizeAndValidate,
  ensureHandleServiceConstraints,
  isServiceDomain,
} from '../../../../handle'
import { hasExplicitSlur } from '../../../../handle/explicit-slurs'
import { prepareCreate } from '../../../../repo/prepare'
import { sendIdentityEventWithRetry } from '../../../../sequencer/identity-event-helper'
import { applyNewAccountDefaults } from '../../../../services/account-defaults'
import { QuickLoginResult } from './store'

export type NeuroCallbackPayload = {
  SessionId: string
  State: string
  JID?: string
  istestuser?: string // "true" for test users; missing = non-test (WP1)
  preferredhandle?: string // Optional suggested handle for first create (WP1)
  emailHash?: string // Optional salted email hash for invitation matching
  emailhash?: string // Backwards-compatible casing variant
  Provider?: string
  Domain?: string
  Key?: string
  Properties?: Record<string, any>
  Created?: string
  Updated?: string
  From?: string
  To?: string
}

/**
 * Normalize JID by stripping resource identifier suffix
 * WID may send: aa7d758f-0726-4a77-a99a-815c5fa98f14@domain/resourceId
 * We use:       aa7d758f-0726-4a77-a99a-815c5fa98f14@domain
 */
export function normalizeJid(jid: string): string {
  // Strip resource identifier suffix (everything after /)
  const slashIndex = jid.indexOf('/')
  return slashIndex > 0 ? jid.substring(0, slashIndex) : jid
}

/**
 * Parse and validate QuickLogin payload (WP1)
 * Returns parsed fields with defaults
 */
export function parseQuickLoginPayload(payload: NeuroCallbackPayload) {
  return {
    jid: normalizeJid(payload.JID || ''),
    isTestUser: payload.istestuser === 'true' ? 1 : 0,
    preferredHandle: payload.preferredhandle || undefined,
  }
}

/**
 * Derive available handle from preferred handle or fallback to "user" + numeric suffix (WP4)
 * - If preferredHandle provided: normalize to lowercase, validate, use
 * - If invalid or taken: fall back to "user-<digits>"
 * - Never use email (privacy separation: no identity fields in PDS)
 */
export async function deriveAvailableHandle(
  ctx: AppContext,
  preferredHandle?: string,
): Promise<string> {
  const defaultBase = 'user'
  let baseName = defaultBase // Default fallback base

  if (preferredHandle) {
    // Normalize preferred handle: lowercase, alphanumeric + dash only
    const normalized = preferredHandle
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes

    // Use normalized handle if non-empty and different from defaultBase
    if (normalized && normalized !== defaultBase) {
      baseName = normalized
    }
  }

  const handleDomain = (
    ctx.cfg.identity.serviceHandleDomains?.[0] || ctx.cfg.service.hostname
  ).replace(/^\./, '')

  // Try base handle first
  let handle = `${baseName}.${handleDomain}`

  // Validate handle meets AT Protocol and service domain constraints
  if (!isHandleValid(handle, baseName, ctx.cfg.identity.serviceHandleDomains)) {
    baseName = defaultBase
    handle = `${baseName}.${handleDomain}`
  }

  let existing = await ctx.accountManager.getAccount(handle)

  if (!existing) {
    return handle
  }

  // Handle taken or base is defaultBase - append random digits until available (WP4 fallback)
  let suffix = ''
  for (let attempts = 0; attempts < 10; attempts++) {
    const randomDigit = Math.floor(Math.random() * 10)
    suffix += randomDigit
    handle = `${baseName}-${suffix}.${handleDomain}`
    existing = await ctx.accountManager.getAccount(handle)

    if (!existing) {
      return handle
    }
  }

  // Safety fallback: use timestamp
  return `ql-${Date.now()}.${handleDomain}`
}

/**
 * Check if a handle passes AT Protocol validation constraints.
 * Used by QuickLogin to validate preferred handles before use.
 */
function isHandleValid(
  handle: string,
  baseName: string,
  serviceHandleDomains: string[],
): boolean {
  try {
    baseNormalizeAndValidate(handle)
    if (!isValidTld(handle)) return false
    if (hasExplicitSlur(baseName)) return false
    if (isServiceDomain(handle, serviceHandleDomains)) {
      // allowReserved=true: QuickLogin handles come from WID provider, not user input
      ensureHandleServiceConstraints(handle, serviceHandleDomains, true)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Create new account via QuickLogin callback (WP3/WP4)
 * Privacy-separated: only jid (pseudonymous) and isTestUser (policy marker) stored
 * No identity fields (email, userName) cached from callback
 */
export async function createAccountViaQuickLogin(
  ctx: AppContext,
  jid: string,
  isTestUser: number,
  preferredHandle?: string,
  log?: any,
  sessionId?: string,
): Promise<QuickLoginResult> {
  // WP4: Derive handle (preferredHandle → "user"+suffix fallback)
  const handle = await deriveAvailableHandle(ctx, preferredHandle)

  if (log && sessionId) {
    log.info({ sessionId, derived: handle }, 'Handle derived for new account')
  }

  // Generate signing keypair
  const signingKey = await Secp256k1Keypair.create({ exportable: true })

  // Create PLC DID operation
  const plcCreate = await plc.createOp({
    signingKey: signingKey.did(),
    rotationKeys: [ctx.plcRotationKey.did()],
    handle,
    pds: ctx.cfg.service.publicUrl,
    signer: ctx.plcRotationKey,
  })

  const did = plcCreate.did

  // Create actor repo with a minimal profile record.
  // An empty repo results in a 'sync' event in the AppView which only calls
  // indexHandle — if the identity event also fails (DID not yet cached), the
  // actor row is never created and the account becomes permanently invisible.
  // Seeding an app.bsky.actor.profile record ensures the AppView receives a
  // 'create' record event that calls indexRecord, guaranteeing actor row creation
  // even if the identity event is dropped due to a DID resolution race.
  await ctx.actorStore.create(did, signingKey)
  const profileWrite = await prepareCreate({
    did,
    collection: 'app.bsky.actor.profile',
    rkey: 'self',
    record: { $type: 'app.bsky.actor.profile' },
    validate: false,
  })
  const commit = await ctx.actorStore.transact(did, (actorTxn) =>
    actorTxn.repo.createRepo([profileWrite]),
  )

  // Publish DID to PLC
  await ctx.plcClient.sendOperation(did, plcCreate.op)

  // Create account with WID authentication (no password)
  // Use synthetic email to satisfy DB constraints while preserving privacy
  const syntheticEmail = `${did.split(':').pop()}@noemail.invalid`
  await ctx.accountManager.createAccount({
    did,
    handle,
    email: syntheticEmail,
    password: undefined, // WID accounts locked to WID authentication
    repoCid: commit.cid,
    repoRev: commit.rev,
    accountType: isTestUser === 1 ? 'test' : 'personal',
  })

  // Email verified by WID identity system
  // Set emailConfirmedAt to enable full account functionality
  await ctx.accountManager.db.db
    .updateTable('account')
    .set({ emailConfirmedAt: new Date().toISOString() })
    .where('did', '=', did)
    .execute()

  // Link Neuro identity (WP3: atomic create)
  // Store only pseudonymous JID key; many-to-many join table
  await ctx.accountManager.db.db
    .insertInto('neuro_identity_link')
    .values({
      jid,
      did,
      linkedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    } as any)
    .execute()

  if (log && sessionId) {
    log.info({ sessionId, created: did }, 'Neuro identity link created')
  }

  // Sequence events
  // Create logger wrapper that includes sessionId if available
  const logger =
    log && sessionId
      ? {
          info: (obj: any, msg: string) => log.info({ sessionId, ...obj }, msg),
          error: (obj: any, msg: string) =>
            log.error({ sessionId, ...obj }, msg),
        }
      : {
          info: () => {},
          error: () => {},
        }

  await sendIdentityEventWithRetry(
    ctx.sequencer,
    ctx.backgroundQueue,
    did,
    handle,
    logger,
    'QuickLogin flow',
  )

  await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
  await ctx.sequencer.sequenceCommit(did, commit)

  await applyNewAccountDefaults(ctx, did, logger)

  // Create session
  const { accessJwt, refreshJwt } = await ctx.accountManager.createSession(
    did,
    null, // No appPassword
    false, // Not privileged
    jid,
  )

  return {
    accessJwt,
    refreshJwt,
    did,
    handle,
    created: true,
  }
}

/**
 * Get handle for a DID
 */
export async function getHandleForDid(
  ctx: AppContext,
  did: string,
): Promise<string> {
  const account = await ctx.accountManager.getAccount(did)
  if (!account) {
    throw new Error('Account not found')
  }
  if (!account.handle) {
    throw new Error('Account has no handle')
  }
  return account.handle
}
