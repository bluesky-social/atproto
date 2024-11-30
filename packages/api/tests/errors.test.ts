import { AtpAgent, ComAtprotoServerCreateAccount } from '..'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('errors', () => {
  let network: TestNetworkNoAppView
  let client: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'known_errors',
    })
    client = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('constructs the correct error instance', async () => {
    const res = client.api.com.atproto.server.createAccount({
      handle: 'admin.blah',
      email: 'admin@test.com',
      password: 'password',
    })
    await expect(res).rejects.toThrow(
      ComAtprotoServerCreateAccount.UnsupportedDomainError,
    )
  })
})
