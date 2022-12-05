import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { CloseFn, runTestServer } from './_util'
import { randomBytes } from '@atproto/crypto'

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

describe('file uploads', () => {
  let client: AtpServiceClient
  let aliceClient: AtpServiceClient
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'crud',
    })
    close = server.close
    client = AtpApi.service(server.url)
    aliceClient = AtpApi.service(server.url)
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await client.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceClient.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
    const res2 = await client.com.atproto.account.create({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bob.did = res2.data.did
  })

  let cid: string

  it('uploads files', async () => {
    const bytes = randomBytes(1000)
    const res = await aliceClient.com.atproto.data.uploadFile(bytes, {
      encoding: 'image/png',
    } as any)
    cid = res.data.cid
  })

  it('can reference the file', async () => {
    await aliceClient.app.bsky.actor.updateProfile({
      displayName: 'Alice',
      avatar: { cid, mimeType: 'image/png' },
    })

    const profile = await aliceClient.app.bsky.actor.getProfile({
      actor: 'alice.test',
    })
    expect(profile.data.avatar).toEqual(cid)
  })
})
