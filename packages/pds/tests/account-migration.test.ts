import AtpAgent from '@atproto/api'
import {
  SeedClient,
  TestNetworkNoAppView,
  TestPds,
  mockNetworkUtilities,
  usersSeed,
} from '@atproto/dev-env'

describe('account migration', () => {
  let network: TestNetworkNoAppView
  let newPds: TestPds

  let sc: SeedClient
  let oldAgent: AtpAgent
  let newAgent: AtpAgent

  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_migration',
    })
    newPds = await TestPds.create({
      didPlcUrl: network.plc.url,
    })
    mockNetworkUtilities(newPds)

    sc = network.getSeedClient()
    oldAgent = network.pds.getClient()
    newAgent = newPds.getClient()

    await usersSeed(sc)
    await network.processAll()

    alice = sc.dids.alice

    await oldAgent.login({
      identifier: sc.accounts[alice].handle,
      password: sc.accounts[alice].password,
    })
  })

  afterAll(async () => {
    await newPds.close()
    await network.close()
  })

  it('works', async () => {
    const describeRes = await newAgent.api.com.atproto.server.describeServer()
    const newServerDid = describeRes.data.did

    const serviceJwtRes = await oldAgent.com.atproto.server.getServiceAuth({
      aud: newServerDid,
    })
    const serviceJwt = serviceJwtRes.data.token

    const created = await newAgent.api.com.atproto.server.createAccount(
      {
        handle: 'new-alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
        did: alice,
      },
      {
        headers: { authorization: `Bearer ${serviceJwt}` },
        encoding: 'application/json',
      },
    )
  })
})
