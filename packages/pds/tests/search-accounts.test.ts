import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import basicSeed from './seeds/basic'

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

  it('allows searching for accounts with email address from a domain', async () => {
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
})
