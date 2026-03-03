import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import { QuickLoginResult } from './store'

export type NeuroCallbackPayload = {
  SessionId: string
  State: string
  JID?: string
  istestuser?: string // "true" for test users; missing = non-test (WP1)
  preferredhandle?: string // Optional suggested handle for first create (WP1)
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
 * Parse and validate QuickLogin payload (WP1)
 * Returns parsed fields with defaults
 */
export function parseQuickLoginPayload(payload: NeuroCallbackPayload) {
  return {
    jid: payload.JID || '',
    isTestUser: payload.istestuser === 'true' ? 1 : 0,
    preferredHandle: payload.preferredhandle || undefined,
  }
}

/**
 * Derive available handle from preferred handle or fallback to "auto" + numeric suffix (WP4)
 * - If preferredHandle provided: normalize to lowercase, validate, use
 * - If invalid or taken: fall back to "auto<digits>"
 * - Never use email (privacy separation: no identity fields in PDS)
 */
export async function deriveAvailableHandle(
  ctx: AppContext,
  preferredHandle?: string,
): Promise<string> {
  let baseName = 'auto' // Default fallback base

  if (preferredHandle) {
    // Normalize preferred handle: lowercase, alphanumeric + dash only
    const normalized = preferredHandle
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes

    // Use normalized handle if non-empty and different from "auto"
    if (normalized && normalized !== 'auto') {
      baseName = normalized
    }
  }

  // Try base handle first
  let handle = `${baseName}.${ctx.cfg.service.hostname}`
  let existing = await ctx.accountManager.getAccount(handle)

  if (!existing) {
    return handle
  }

  // Handle taken or base is "auto" - append random digits until available (WP4 fallback)
  let suffix = ''
  for (let attempts = 0; attempts < 10; attempts++) {
    const randomDigit = Math.floor(Math.random() * 10)
    suffix += randomDigit
    handle = `${baseName}-${suffix}.${ctx.cfg.service.hostname}`
    existing = await ctx.accountManager.getAccount(handle)

    if (!existing) {
      return handle
    }
  }

  // Safety fallback: use timestamp-based handle
  return `auto-${Date.now()}.${ctx.cfg.service.hostname}`
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
  // WP4: Derive handle (preferredHandle → auto+suffix fallback)
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

  // Create actor repo
  await ctx.actorStore.create(did, signingKey)
  const commit = await ctx.actorStore.transact(did, (actorTxn) =>
    actorTxn.repo.createRepo([]),
  )

  // Publish DID to PLC
  await ctx.plcClient.sendOperation(did, plcCreate.op)

  // Create account (without password; no email for QuickLogin)
  await ctx.accountManager.createAccount({
    did,
    handle,
    email: undefined, // No email stored; privacy separation
    password: undefined, // No password for QuickLogin accounts
    repoCid: commit.cid,
    repoRev: commit.rev,
  })

  // Email verified by Neuro identity system (just not stored in PDS)
  // Set emailConfirmedAt to enable full account functionality
  await ctx.accountManager.db.db
    .updateTable('account')
    .set({ emailConfirmedAt: new Date().toISOString() })
    .where('did', '=', did)
    .execute()

  // Link Neuro identity (WP3: atomic create)
  // Store only pseudonymous JID key; no identity attributes from callback
  const linkData = {
    did,
    isTestUser,
    linkedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    ...(isTestUser === 1
      ? { testUserJid: jid, userJid: null } // Test user: testUserJid
      : { userJid: jid, testUserJid: null }), // Real user: userJid
  }

  await ctx.accountManager.db.db
    .insertInto('neuro_identity_link')
    .values(linkData as any)
    .execute()

  if (log && sessionId) {
    log.info({ sessionId, created: did }, 'Neuro identity link created')
  }

  // Sequence events
  await ctx.sequencer.sequenceIdentityEvt(did, handle)
  await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
  await ctx.sequencer.sequenceCommit(did, commit)

  // Create session
  const { accessJwt, refreshJwt } = await ctx.accountManager.createSession(
    did,
    null, // No appPassword
    false, // Not privileged
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
