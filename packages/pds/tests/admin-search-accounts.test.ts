import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import usersSeed, { users } from './seeds/users'

describe('com.atproto.admin.searchAccounts', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'pds_admin_search_accounts',
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns all accounts when no filter is provided', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      {},
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(res.data.accounts.length).toBeGreaterThanOrEqual(4)
    const handles = res.data.accounts.map((a) => a.handle)
    expect(handles).toContain('alice.test')
    expect(handles).toContain('bob.test')
    expect(handles).toContain('carol.test')
    expect(handles).toContain('dan.test')
  })

  it('filters accounts by exact email', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      { email: 'alice@test.com' },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(res.data.accounts.length).toBe(1)
    expect(res.data.accounts[0].handle).toBe('alice.test')
    expect(res.data.accounts[0].email).toBe('alice@test.com')
  })

  it('filters accounts by partial email', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      { email: 'test.com' },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(res.data.accounts.length).toBeGreaterThanOrEqual(4)
  })

  it('returns empty list when email does not match', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      { email: 'doesnotexist@nowhere.com' },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(res.data.accounts).toHaveLength(0)
    expect(res.data.cursor).toBeUndefined()
  })

  it('returns account fields: did, handle, email, indexedAt', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      { email: 'bob@test.com' },
      { headers: network.pds.adminAuthHeaders() },
    )
    const account = res.data.accounts[0]
    expect(account.did).toMatch(/^did:/)
    expect(account.handle).toBe('bob.test')
    expect(account.email).toBe('bob@test.com')
    expect(account.indexedAt).toBeDefined()
  })

  it('paginates results using limit and cursor', async () => {
    const page1 = await agent.api.com.atproto.admin.searchAccounts(
      { limit: 2 },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(page1.data.accounts).toHaveLength(2)
    expect(page1.data.cursor).toBeDefined()

    const page2 = await agent.api.com.atproto.admin.searchAccounts(
      { limit: 2, cursor: page1.data.cursor },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(page2.data.accounts.length).toBeGreaterThanOrEqual(2)

    const page1Dids = page1.data.accounts.map((a) => a.did)
    const page2Dids = page2.data.accounts.map((a) => a.did)
    const overlap = page1Dids.filter((did) => page2Dids.includes(did))
    expect(overlap).toHaveLength(0)
  })

  it('returns no cursor when results are exhausted', async () => {
    const res = await agent.api.com.atproto.admin.searchAccounts(
      { limit: 100 },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(res.data.cursor).toBeUndefined()
  })

  it('rejects requests without auth', async () => {
    await expect(
      agent.api.com.atproto.admin.searchAccounts({}),
    ).rejects.toThrow()
  })

  it('rejects requests with user access token instead of admin auth', async () => {
    const { data: session } =
      await agent.api.com.atproto.server.createSession({
        identifier: users.alice.handle,
        password: users.alice.password,
      })
    await expect(
      agent.api.com.atproto.admin.searchAccounts(
        {},
        { headers: { authorization: `Bearer ${session.accessJwt}` } },
      ),
    ).rejects.toThrow()
  })
})
