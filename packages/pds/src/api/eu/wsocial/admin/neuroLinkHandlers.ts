/**
 * Shared business logic for neuro-link admin operations.
 *
 * Imported by:
 *   - eu/wsocial/admin/*.ts  (canonical handlers)
 *   - com/atproto/admin/*NeuroLink*.ts  (backwards-compat shims, delete after September 2026)
 */
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'

type Log = { info(obj: object, msg: string): void }

// ---------------------------------------------------------------------------
// addNeuroLink
// ---------------------------------------------------------------------------
export async function addNeuroLink(
  ctx: AppContext,
  body: { jid: string; did: string },
  log: Log,
) {
  const { jid, did } = body

  const account = await ctx.accountManager.db.db
    .selectFrom('account')
    .select(['did'])
    .where('did', '=', did)
    .executeTakeFirst()

  if (!account) {
    throw new InvalidRequestError('Account not found', 'NotFound')
  }

  const conflict = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['did'])
    .where('jid', '=', jid)
    .where('did', '=', did)
    .executeTakeFirst()

  if (conflict) {
    throw new InvalidRequestError(
      'This JID is already linked to this account',
      'JidInUse',
    )
  }

  const linkedAt = new Date().toISOString()
  await ctx.accountManager.db.db
    .insertInto('neuro_identity_link')
    .values({ jid, did, linkedAt, lastLoginAt: null })
    .execute()

  log.info({ did, jid }, 'Added Neuro identity link')
  return { encoding: 'application/json' as const, body: { success: true, jid, did, linkedAt } }
}

// ---------------------------------------------------------------------------
// getNeuroLink
// ---------------------------------------------------------------------------
export async function getNeuroLink(ctx: AppContext, params: { did: string }) {
  const { did } = params

  const [account, actor, neuroLinks] = await Promise.all([
    ctx.accountManager.getAccount(did),
    ctx.accountManager.db.db
      .selectFrom('actor')
      .select(['accountType'])
      .where('did', '=', did)
      .executeTakeFirst(),
    ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', did)
      .orderBy('linkedAt', 'asc')
      .execute(),
  ])

  if (!account) {
    throw new InvalidRequestError('Account not found', 'NotFound')
  }

  const primary = neuroLinks[0]
  return {
    encoding: 'application/json' as const,
    body: {
      did: account.did,
      handle: account.handle || '',
      email: account.email || undefined,
      accountType: actor?.accountType || 'organization',
      jid: primary?.jid || undefined,
      linkedAt: primary?.linkedAt || undefined,
      lastLoginAt: primary?.lastLoginAt || undefined,
      neuroLinks: neuroLinks.map((l) => ({
        jid: l.jid,
        linkedAt: l.linkedAt || undefined,
        lastLoginAt: l.lastLoginAt || undefined,
      })),
    },
  }
}

// ---------------------------------------------------------------------------
// listNeuroAccounts
// ---------------------------------------------------------------------------
export async function listNeuroAccounts(
  ctx: AppContext,
  params: { limit?: number; cursor?: string },
) {
  const { limit = 100, cursor } = params

  let query = ctx.accountManager.db.db
    .selectFrom('actor')
    .leftJoin('account', 'actor.did', 'account.did')
    .select([
      'actor.did as did',
      'actor.handle as handle',
      'actor.accountType as accountType',
      'account.email as email',
    ])
    .where('actor.deactivatedAt', 'is', null)
    .where((qb) =>
      qb
        .where('actor.takedownRef', 'is', null)
        .orWhere('actor.takedownRef', '=', ''),
    )

  if (cursor) {
    query = query.where('actor.handle', '>', cursor)
  }

  const accounts = await query
    .orderBy('actor.handle', 'asc')
    .limit(limit + 1)
    .execute()

  const dids = accounts.map((acc) => acc.did)
  const allNeuroLinks = dids.length
    ? await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['jid', 'did', 'linkedAt', 'lastLoginAt'])
        .where('did', 'in', dids)
        .orderBy('lastLoginAt', 'desc')
        .execute()
    : []

  const neuroLinksByDid = new Map<string, typeof allNeuroLinks>()
  for (const link of allNeuroLinks) {
    const existing = neuroLinksByDid.get(link.did) ?? []
    existing.push(link)
    neuroLinksByDid.set(link.did, existing)
  }

  const hasMore = accounts.length > limit
  const accountsToReturn = hasMore ? accounts.slice(0, limit) : accounts
  const nextCursor = hasMore
    ? accountsToReturn[accountsToReturn.length - 1].handle
    : undefined

  return {
    encoding: 'application/json' as const,
    body: {
      accounts: accountsToReturn.map((account) => {
        const links = neuroLinksByDid.get(account.did) ?? []
        const primary = links[0]
        return {
          did: account.did,
          handle: account.handle || '',
          email: account.email || undefined,
          accountType: account.accountType,
          jid: primary?.jid || undefined,
          linkedAt: primary?.linkedAt || undefined,
          lastLoginAt: primary?.lastLoginAt || undefined,
          neuroLinks: links.map((l) => ({
            jid: l.jid,
            linkedAt: l.linkedAt || undefined,
            lastLoginAt: l.lastLoginAt || undefined,
          })),
        }
      }),
      cursor: nextCursor || undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// removeNeuroLink
// ---------------------------------------------------------------------------
export async function removeNeuroLink(
  ctx: AppContext,
  body: { jid: string; did: string },
  log: Log,
) {
  const { jid, did } = body

  const link = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['jid', 'did'])
    .where('jid', '=', jid)
    .where('did', '=', did)
    .executeTakeFirst()

  if (!link) {
    throw new InvalidRequestError(
      'No link found for this JID/DID combination',
      'NotFound',
    )
  }

  const remainingLinks = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['jid'])
    .where('did', '=', did)
    .execute()

  const isLastLink = remainingLinks.length === 1

  await ctx.accountManager.db.db
    .deleteFrom('neuro_identity_link')
    .where('jid', '=', jid)
    .where('did', '=', did)
    .execute()

  await ctx.accountManager.revokeAllSessionsForDid(did)

  log.info({ did, jid, isLastLink }, 'Removed Neuro identity link')

  return {
    encoding: 'application/json' as const,
    body: {
      success: true,
      jid,
      did,
      warning: isLastLink
        ? 'This was the last JID linked to this account. The account can no longer log in via QuickLogin.'
        : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// updateNeuroLink
// ---------------------------------------------------------------------------
export async function updateNeuroLink(
  ctx: AppContext,
  body: { did: string; newJid: string },
  log: Log,
) {
  const { did, newJid } = body

  const account = await ctx.accountManager.db.db
    .selectFrom('account')
    .select(['did'])
    .where('did', '=', did)
    .executeTakeFirst()

  if (!account) {
    throw new InvalidRequestError('Account not found', 'NotFound')
  }

  const conflict = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['did', 'jid'])
    .where('jid', '=', newJid)
    .executeTakeFirst()

  if (conflict && conflict.did !== did) {
    throw new InvalidRequestError(
      `This JID is already linked to account ${conflict.did}`,
      'JidInUse',
    )
  }

  const currentLinks = await ctx.accountManager.db.db
    .selectFrom('neuro_identity_link')
    .select(['jid'])
    .where('did', '=', did)
    .orderBy('linkedAt', 'asc')
    .execute()

  const oldJid = currentLinks[0]?.jid || null
  const updatedAt = new Date().toISOString()

  if (currentLinks.length > 0) {
    await ctx.accountManager.db.db
      .updateTable('neuro_identity_link')
      .set({ jid: newJid, lastLoginAt: null })
      .where('did', '=', did)
      .where('jid', '=', oldJid!)
      .execute()
  } else {
    await ctx.accountManager.db.db
      .insertInto('neuro_identity_link')
      .values({ jid: newJid, did, linkedAt: updatedAt, lastLoginAt: null })
      .execute()
  }

  log.info({ did, oldJid, newJid }, 'Updated Neuro identity link')

  return {
    encoding: 'application/json' as const,
    body: {
      success: true,
      deprecated:
        'updateNeuroLink is deprecated. Use addNeuroLink/removeNeuroLink instead.',
      did,
      oldJid: oldJid || undefined,
      newJid,
      updatedAt,
    },
  }
}
