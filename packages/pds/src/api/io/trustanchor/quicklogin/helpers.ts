import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import { QuickLoginResult } from './store'

export type NeuroCallbackPayload = {
  SessionId: string
  State: string
  JID?: string
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
 * Extract email from Neuro properties (case-insensitive)
 */
export function extractEmail(
  properties?: Record<string, any>,
): string | undefined {
  if (!properties) return undefined

  // Try common cases
  if (properties.EMAIL) return properties.EMAIL
  if (properties.email) return properties.email
  if (properties.Email) return properties.Email

  // Case-insensitive search
  const emailKey = Object.keys(properties).find(
    (key) => key.toLowerCase() === 'email',
  )
  return emailKey ? properties[emailKey] : undefined
}

/**
 * Extract user name from Neuro properties (case-insensitive)
 * Returns lowercase name for Caddy compatibility
 */
export function extractUserName(
  properties?: Record<string, any>,
): string | undefined {
  if (!properties) return undefined

  // Try common cases
  if (properties.NAME) return properties.NAME.toLowerCase()
  if (properties.name) return properties.name.toLowerCase()
  if (properties.Name) return properties.Name.toLowerCase()

  // Case-insensitive search
  const nameKey = Object.keys(properties).find(
    (key) => key.toLowerCase() === 'name',
  )
  return nameKey ? properties[nameKey].toLowerCase() : undefined
}

/**
 * Derive available handle from email or preferred handle
 * Priority: preferredHandle → email-based → timestamp
 */
export async function deriveAvailableHandle(
  ctx: AppContext,
  email?: string,
  preferredHandle?: string | null,
): Promise<string> {
  let baseName: string

  if (preferredHandle) {
    // Use preferred handle if provided
    baseName = preferredHandle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
  } else if (email) {
    // Extract username from email (e.g., "john.doe@example.com" → "john-doe")
    const emailUsername = email.split('@')[0]
    baseName = emailUsername
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
  } else {
    // Fallback to timestamp-based handle
    baseName = `ql-${Date.now()}`
  }

  // Try base handle first
  let handle = `${baseName}.${ctx.cfg.service.hostname}`
  let existing = await ctx.accountManager.getAccount(handle)

  if (!existing) {
    return handle
  }

  // Handle taken, append random digits
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

  // Safety fallback: use timestamp
  return `ql-${Date.now()}.${ctx.cfg.service.hostname}`
}

/**
 * Create new account via QuickLogin and return credentials
 */
export async function createAccountViaQuickLogin(
  ctx: AppContext,
  neuroJid: string,
  email?: string,
  userName?: string,
  preferredHandle?: string | null,
): Promise<QuickLoginResult> {
  // Derive handle from preferred handle, email, or fallback
  const handle = await deriveAvailableHandle(ctx, email, preferredHandle)

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

  // Create account (without password)
  await ctx.accountManager.createAccount({
    did,
    handle,
    email: email,
    password: undefined, // No password for QuickLogin accounts
    repoCid: commit.cid,
    repoRev: commit.rev,
  })

  // Link Neuro identity
  await ctx.accountManager.db.db
    .insertInto('neuro_identity_link')
    .values({
      neuroJid,
      did,
      email: email || null,
      userName: userName || null,
      linkedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    })
    .execute()

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
