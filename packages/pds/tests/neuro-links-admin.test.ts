/**
 * Admin Neuro Link API Tests
 *
 * Tests the many-to-many WID <-> WSOC account linking endpoints:
 *   - eu.wsocial.admin.addNeuroLink
 *   - eu.wsocial.admin.removeNeuroLink
 *   - eu.wsocial.admin.getNeuroLink
 *   - eu.wsocial.admin.listNeuroAccounts
 *   - eu.wsocial.admin.updateNeuroLink (deprecated, but still functional)
 *
 * The old com.atproto.admin.* paths remain as backwards-compat shims
 * and can be deleted after September 2026.
 *
 * Also verifies:
 *   - Unauthenticated callers are rejected (401)
 *
 * Run with:
 *   pnpm test neuro-links-admin
 */

import { TestNetworkNoAppView } from '@atproto/dev-env'
import { createAccountViaQuickLogin } from '../src/api/io/trustanchor/quicklogin/helpers'

// Admin password is always 'admin-pass' in the test network (see dev-env/src/const.ts)
const ADMIN_PASSWORD = 'admin-pass'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a raw XRPC call with admin Basic-auth credentials. */
async function adminFetch(
  pdsUrl: string,
  method: 'GET' | 'POST',
  nsid: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>,
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${pdsUrl}/xrpc/${nsid}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const encoded = Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

/** Same as adminFetch but with NO auth header (for security tests). */
async function unauthFetch(
  pdsUrl: string,
  method: 'GET' | 'POST',
  nsid: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>,
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${pdsUrl}/xrpc/${nsid}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('admin neuro link management', () => {
  let network: TestNetworkNoAppView
  let pdsUrl: string

  let aliceDid: string
  let bobDid: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'neuro_links_admin',
    })
    pdsUrl = network.pds.url

    // Create test accounts via QuickLogin helper (bypasses password requirement)
    const ctx = network.pds.ctx
    const alice = await createAccountViaQuickLogin(
      ctx,
      'alice@wsocial.eu',
      0,
      'alice',
    )
    const bob = await createAccountViaQuickLogin(
      ctx,
      'bob-setup@wsocial.eu',
      0,
      'bob',
    )
    aliceDid = alice.did
    bobDid = bob.did

    // Remove the auto-created links so each test starts with a clean slate
    await ctx.accountManager.db.db
      .deleteFrom('neuro_identity_link')
      .where('did', 'in', [aliceDid, bobDid])
      .execute()
  })

  afterAll(async () => {
    await network.close()
  })

  // -------------------------------------------------------------------------
  // Security: unauthenticated calls must be rejected
  // -------------------------------------------------------------------------

  describe('security: unauthenticated callers are rejected', () => {
    it('addNeuroLink requires admin auth', async () => {
      const { status } = await unauthFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.addNeuroLink',
        { jid: 'alice@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(401)
    })

    it('removeNeuroLink requires admin auth', async () => {
      const { status } = await unauthFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.removeNeuroLink',
        { jid: 'alice@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(401)
    })

    it('getNeuroLink requires admin auth', async () => {
      const { status } = await unauthFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        {
          did: aliceDid,
        },
      )
      expect(status).toBe(401)
    })

    it('listNeuroAccounts requires admin auth', async () => {
      const { status } = await unauthFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.listNeuroAccounts',
      )
      expect(status).toBe(401)
    })

    it('updateNeuroLink requires admin auth', async () => {
      const { status } = await unauthFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.updateNeuroLink',
        { did: aliceDid, newJid: 'new@wsocial.eu' },
      )
      expect(status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // addNeuroLink
  // -------------------------------------------------------------------------

  describe('addNeuroLink', () => {
    it('links a JID to an account', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.addNeuroLink',
        { jid: 'alice@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.success).toBe(true)
      expect(d.jid).toBe('alice@wsocial.eu')
      expect(d.did).toBe(aliceDid)
      expect(typeof d.linkedAt).toBe('string')
    })

    it('allows the same JID to be linked to a second account (many-to-many)', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.addNeuroLink',
        { jid: 'alice@wsocial.eu', did: bobDid },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.success).toBe(true)
    })

    it('rejects duplicate (jid, did) links with JidInUse', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.addNeuroLink',
        { jid: 'alice@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(400)
      const d = data as Record<string, unknown>
      expect(d.error).toBe('JidInUse')
    })

    it('rejects unknown DID with NotFound', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.addNeuroLink',
        { jid: 'ghost@wsocial.eu', did: 'did:plc:doesnotexist000000000000' },
      )
      expect(status).toBe(400)
      const d = data as Record<string, unknown>
      expect(d.error).toBe('NotFound')
    })
  })

  // -------------------------------------------------------------------------
  // getNeuroLink
  // -------------------------------------------------------------------------

  describe('getNeuroLink', () => {
    it('returns the link for a linked account', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        { did: aliceDid },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.did).toBe(aliceDid)
      const links = d.neuroLinks as Array<{ jid: string }>
      expect(links.some((l) => l.jid === 'alice@wsocial.eu')).toBe(true)
    })

    it('returns empty neuroLinks for an unlinked account', async () => {
      const ctx = network.pds.ctx
      const carol = await createAccountViaQuickLogin(
        ctx,
        'carol-setup@wsocial.eu',
        0,
        'carol',
      )
      // Remove the auto-created link
      await ctx.accountManager.db.db
        .deleteFrom('neuro_identity_link')
        .where('did', '=', carol.did)
        .execute()

      const { status, data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        { did: carol.did },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect((d.neuroLinks as unknown[]).length).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // listNeuroAccounts
  // -------------------------------------------------------------------------

  describe('listNeuroAccounts', () => {
    it('returns accounts with their neuro links', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.listNeuroAccounts',
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      const accounts = d.accounts as Array<{
        did: string
        neuroLinks: unknown[]
      }>
      const aliceEntry = accounts.find((a) => a.did === aliceDid)
      expect(aliceEntry).toBeDefined()
      expect(aliceEntry!.neuroLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('shows a valid accountType on each account', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.listNeuroAccounts',
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      const accounts = d.accounts as Array<{ accountType: string }>
      for (const acct of accounts) {
        expect(['personal', 'test', 'organization', 'bot']).toContain(
          acct.accountType,
        )
      }
    })
  })

  // -------------------------------------------------------------------------
  // removeNeuroLink
  // -------------------------------------------------------------------------

  describe('removeNeuroLink', () => {
    it('removes a specific (jid, did) link', async () => {
      // alice@wsocial.eu is linked to both aliceDid and bobDid — remove bob's
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.removeNeuroLink',
        { jid: 'alice@wsocial.eu', did: bobDid },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.success).toBe(true)
      expect(d.jid).toBe('alice@wsocial.eu')
      expect(d.did).toBe(bobDid)
    })

    it("does not affect alice's link when bob's is removed", async () => {
      const { data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        { did: aliceDid },
      )
      const d = data as Record<string, unknown>
      const links = d.neuroLinks as Array<{ jid: string }>
      expect(links.some((l) => l.jid === 'alice@wsocial.eu')).toBe(true)
    })

    it('issues a warning when removing the last link for an account', async () => {
      // alice only has alice@wsocial.eu left
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.removeNeuroLink',
        { jid: 'alice@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.success).toBe(true)
      expect(typeof d.warning).toBe('string')
    })

    it('rejects removal of a non-existent link with NotFound', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.removeNeuroLink',
        { jid: 'nobody@wsocial.eu', did: aliceDid },
      )
      expect(status).toBe(400)
      const d = data as Record<string, unknown>
      expect(d.error).toBe('NotFound')
    })
  })

  // -------------------------------------------------------------------------
  // Multiple links per account (many-to-many)
  // -------------------------------------------------------------------------

  describe('many-to-many: multiple JIDs per account', () => {
    let danDid: string

    beforeAll(async () => {
      const ctx = network.pds.ctx
      const dan = await createAccountViaQuickLogin(
        ctx,
        'dan-setup@wsocial.eu',
        0,
        'dan',
      )
      danDid = dan.did
      // Remove the auto-created link so we control all links in this block
      await ctx.accountManager.db.db
        .deleteFrom('neuro_identity_link')
        .where('did', '=', danDid)
        .execute()
    })

    it('can link multiple JIDs to the same account', async () => {
      await adminFetch(pdsUrl, 'POST', 'eu.wsocial.admin.addNeuroLink', {
        jid: 'dan-phone@wsocial.eu',
        did: danDid,
      })
      await adminFetch(pdsUrl, 'POST', 'eu.wsocial.admin.addNeuroLink', {
        jid: 'dan-tablet@wsocial.eu',
        did: danDid,
      })

      const { data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        { did: danDid },
      )
      const d = data as Record<string, unknown>
      const links = d.neuroLinks as Array<{ jid: string }>
      const jids = links.map((l) => l.jid)
      expect(jids).toContain('dan-phone@wsocial.eu')
      expect(jids).toContain('dan-tablet@wsocial.eu')
    })

    it('removing one JID does not affect the other', async () => {
      await adminFetch(pdsUrl, 'POST', 'eu.wsocial.admin.removeNeuroLink', {
        jid: 'dan-phone@wsocial.eu',
        did: danDid,
      })

      const { data } = await adminFetch(
        pdsUrl,
        'GET',
        'eu.wsocial.admin.getNeuroLink',
        undefined,
        { did: danDid },
      )
      const d = data as Record<string, unknown>
      const links = d.neuroLinks as Array<{ jid: string }>
      const jids = links.map((l) => l.jid)
      expect(jids).not.toContain('dan-phone@wsocial.eu')
      expect(jids).toContain('dan-tablet@wsocial.eu')
    })
  })

  // -------------------------------------------------------------------------
  // updateNeuroLink (deprecated)
  // -------------------------------------------------------------------------

  describe('updateNeuroLink (deprecated)', () => {
    let eveDid: string
    let frankDid: string

    beforeAll(async () => {
      const ctx = network.pds.ctx
      const eve = await createAccountViaQuickLogin(
        ctx,
        'eve-setup@wsocial.eu',
        0,
        'eve',
      )
      const frank = await createAccountViaQuickLogin(
        ctx,
        'frank@wsocial.eu',
        0,
        'frank',
      )
      eveDid = eve.did
      frankDid = frank.did
      // Remove auto-created links, then give eve a known link
      await ctx.accountManager.db.db
        .deleteFrom('neuro_identity_link')
        .where('did', 'in', [eveDid, frankDid])
        .execute()
      await adminFetch(pdsUrl, 'POST', 'eu.wsocial.admin.addNeuroLink', {
        jid: 'eve-old@wsocial.eu',
        did: eveDid,
      })
    })

    it('updates the JID and includes a deprecated field in the response', async () => {
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.updateNeuroLink',
        { did: eveDid, newJid: 'eve-new@wsocial.eu' },
      )
      expect(status).toBe(200)
      const d = data as Record<string, unknown>
      expect(d.success).toBe(true)
      expect(d.newJid).toBe('eve-new@wsocial.eu')
      expect(typeof d.deprecated).toBe('string')
    })

    it('rejects updating to a JID already linked to a different account', async () => {
      // First give frank a link
      await adminFetch(pdsUrl, 'POST', 'eu.wsocial.admin.addNeuroLink', {
        jid: 'frank@wsocial.eu',
        did: frankDid,
      })
      // Now try to give eve that same JID
      const { status, data } = await adminFetch(
        pdsUrl,
        'POST',
        'eu.wsocial.admin.updateNeuroLink',
        { did: eveDid, newJid: 'frank@wsocial.eu' },
      )
      expect(status).toBe(400)
      const d = data as Record<string, unknown>
      expect(d.error).toBe('JidInUse')
    })
  })
})
