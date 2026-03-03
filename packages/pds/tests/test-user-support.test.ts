import { TestNetworkNoAppView } from '@atproto/dev-env'
import { createAccountViaQuickLogin } from '../src/api/io/trustanchor/quicklogin/helpers'

describe('Test User Support', () => {
  let network: TestNetworkNoAppView

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      pds: {
        neuro: {
          enabled: true,
          domain: 'test.lab.tagroot.io',
          storageBackend: 'database' as const,
        },
      },
      dbPostgresSchema: 'test_user_support',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('stores real QuickLogin users in userJid', async () => {
    const ctx = network.pds.ctx
    const userJid = `real-${Date.now()}@legal.lab.tagroot.io`

    const result = await createAccountViaQuickLogin(
      ctx,
      userJid,
      0,
      `real${Date.now()}`,
    )

    const link = await ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', result.did)
      .executeTakeFirst()

    expect(link?.userJid).toBe(userJid)
    expect(link?.testUserJid).toBeNull()
    expect(link?.isTestUser).toBe(0)
  })

  it('stores test QuickLogin users in testUserJid', async () => {
    const ctx = network.pds.ctx
    const testUserJid = `TestUser-${Date.now()}@lab.tagroot.io`

    const result = await createAccountViaQuickLogin(
      ctx,
      testUserJid,
      1,
      `test${Date.now()}`,
    )

    const link = await ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', result.did)
      .executeTakeFirst()

    expect(link?.userJid).toBeNull()
    expect(link?.testUserJid).toBe(testUserJid)
    expect(link?.isTestUser).toBe(1)
  })

  it('finds accounts by either userJid or testUserJid', async () => {
    const ctx = network.pds.ctx
    const manager = ctx.neuroAuthManager!

    const realJid = `lookup-real-${Date.now()}@legal.io`
    const testJid = `lookup-test-${Date.now()}@lab.io`

    const real = await createAccountViaQuickLogin(
      ctx,
      realJid,
      0,
      `lookupreal${Date.now()}`,
    )
    const test = await createAccountViaQuickLogin(
      ctx,
      testJid,
      1,
      `lookuptest${Date.now()}`,
    )

    const foundReal = await manager.findAccountByLegalIdOrJid(realJid)
    const foundTest = await manager.findAccountByLegalIdOrJid(testJid)

    expect(foundReal?.did).toBe(real.did)
    expect(foundTest?.did).toBe(test.did)
  })

  it('keeps mutual exclusivity across JID columns', async () => {
    const ctx = network.pds.ctx

    const real = await createAccountViaQuickLogin(
      ctx,
      `exclusive-real-${Date.now()}@legal.io`,
      0,
      `exclusive-real-${Date.now()}`,
    )
    const test = await createAccountViaQuickLogin(
      ctx,
      `exclusive-test-${Date.now()}@lab.io`,
      1,
      `exclusive-test-${Date.now()}`,
    )

    const links = await ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .select(['did', 'userJid', 'testUserJid'])
      .where('did', 'in', [real.did, test.did])
      .execute()

    for (const link of links) {
      const populated = [link.userJid, link.testUserJid].filter(
        (col) => col !== null,
      )
      expect(populated).toHaveLength(1)
    }
  })
})
