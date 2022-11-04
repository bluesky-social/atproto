import {
  sessionClient,
  SessionServiceClient as AtpSessionClient,
} from '@atproto/api'
import { CloseFn, runTestServer } from './_util'

const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  did: '',
  password: 'alice-pass',
}
const bob = {
  email: 'bob@test.com',
  handle: 'bob.test',
  did: '',
  password: 'bob-pass',
}

describe('scenes', () => {
  let aliceClient: AtpSessionClient
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'scenes',
    })
    close = server.close

    // AtpSessionClient
    // AtpApi.service.
    aliceClient = sessionClient.service(server.url)
    await aliceClient.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
  })

  afterAll(async () => {
    await close()
  })

  it('creates a scene', async () => {
    await aliceClient.app.bsky.actor.createScene({
      handle: 'scene.test',
    })
  })
})
