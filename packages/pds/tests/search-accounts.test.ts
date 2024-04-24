import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import basicSeed from './seeds/basic'
import { forSnapshot } from './_util'

describe('search accounts', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'search_accounts',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows searching for accounts with email address', async () => {
    const [{ data: firstAccount }, { data: secondAccount }] = await Promise.all(
      [
        agent.createAccount({
          email: 'o.n.e@email.com',
          password: 'password',
          handle: 'one1.test',
        }),
        agent.createAccount({
          email: 'one+test@email.com',
          password: 'password',
          handle: 'one2.test',
        }),
      ],
    )
    const [{ data: byDomain }, { data: byNormalizedAddress }] =
      await Promise.all([
        agent.api.com.atproto.admin.searchAccounts(
          { email: '@email.com' },
          { headers: network.pds.adminAuthHeaders() },
        ),
        agent.api.com.atproto.admin.searchAccounts(
          { email: 'one@email.com' },
          { headers: network.pds.adminAuthHeaders() },
        ),
      ])
    const accountDidsByDomain = byDomain.accounts.map((account) => account.did)
    const accountDidsByNormalizedAddress = byNormalizedAddress.accounts.map(
      (account) => account.did,
    )
    expect(accountDidsByDomain.length).toBe(2)
    expect(accountDidsByNormalizedAddress.length).toBe(2)

    expect(accountDidsByDomain).toContain(firstAccount.did)
    expect(accountDidsByDomain).toContain(secondAccount.did)
    expect(accountDidsByNormalizedAddress).toContain(firstAccount.did)
    expect(accountDidsByNormalizedAddress).toContain(secondAccount.did)
  })

  it('paginates search results', async () => {
    await Promise.all([
      network.pds.getClient().createAccount({
        email: 'two@email.com',
        password: 'password',
        handle: 'two1.test',
      }),
      network.pds.getClient().createAccount({
        email: 'two+test@email.com',
        password: 'password',
        handle: 'two2.test',
      }),
    ])

    const { data: pageOne } = await agent.api.com.atproto.admin.searchAccounts(
      { email: '@email.com', limit: 2 },
      { headers: network.pds.adminAuthHeaders() },
    )
    const { data: pageTwo } = await agent.api.com.atproto.admin.searchAccounts(
      { email: '@email.com', limit: 2, cursor: pageOne.cursor },
      { headers: network.pds.adminAuthHeaders() },
    )
    const { data: pageThree } =
      await agent.api.com.atproto.admin.searchAccounts(
        { email: '@email.com', limit: 2, cursor: pageTwo.cursor },
        { headers: network.pds.adminAuthHeaders() },
      )

    const allAccounts = [...pageOne.accounts, ...pageTwo.accounts]
    const allEmails = allAccounts.map((account) => account.email)
    expect(forSnapshot(allAccounts)).toMatchSnapshot()
    expect(allEmails).toContain('o.n.e@email.com')
    expect(allEmails).toContain('one+test@email.com')
    expect(allEmails).toContain('two@email.com')
    expect(allEmails).toContain('two+test@email.com')
    expect(pageThree.accounts.length).toBe(0)
  })
})
