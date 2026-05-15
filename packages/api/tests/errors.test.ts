// @NOTE must be imported from here to match dev-env's built error types
import { ComAtprotoServerCreateAccount } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('errors', () => {
  let network: TestNetworkNoAppView
  let client: ReturnType<TestNetworkNoAppView['pds']['getAgent']>

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'known_errors',
    })
    client = network.pds.getAgent()
  })

  afterAll(async () => {
    await network.close()
  })

  it('constructs the correct error instance', async () => {
    const res = client.com.atproto.server.createAccount({
      handle: 'admin.blah',
      email: 'admin@test.com',
      password: 'password',
    })
    await expect(res).rejects.toThrow(
      ComAtprotoServerCreateAccount.UnsupportedDomainError,
    )
  })
})
