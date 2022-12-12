import {
  CloseFn,
  runTestServer,
  TestServerInfo,
} from '@atproto/pds/tests/_util'
import {
  sessionClient,
  SessionServiceClient,
  ComAtprotoAccountCreate,
} from '..'

describe('errors', () => {
  let server: TestServerInfo
  let client: SessionServiceClient
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'known_errors',
    })
    client = sessionClient.service(server.url)
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  it('constructs the correct error instance', async () => {
    const res = client.com.atproto.account.create({
      handle: 'admin',
      email: 'admin@test.com',
      password: 'password',
    })
    await expect(res).rejects.toThrow(
      ComAtprotoAccountCreate.InvalidHandleError,
    )
  })
})
