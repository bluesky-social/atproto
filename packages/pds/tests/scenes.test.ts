import {
  sessionClient,
  SessionServiceClient as AtpSessionClient,
} from '@atproto/api'
import { CloseFn, runTestServer } from './_util'

const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  did: '',
  declarationCid: '',
  password: 'alice-pass',
}

const bob = {
  email: 'bob@test.com',
  handle: 'bob.test',
  did: '',
  declarationCid: '',
  password: 'bob-pass',
}

describe('scenes', () => {
  let aliceClient: AtpSessionClient
  let bobClient: AtpSessionClient
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'scenes',
    })
    close = server.close

    aliceClient = sessionClient.service(server.url)
    const aliceRes = await aliceClient.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    alice.did = aliceRes.data.did
    alice.declarationCid = aliceRes.data.declarationCid

    bobClient = sessionClient.service(server.url)
    const bobRes = await bobClient.com.atproto.account.create({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bob.did = bobRes.data.did
    bob.declarationCid = bobRes.data.declarationCid
  })

  afterAll(async () => {
    await close()
  })

  let scene

  it('creates a scene', async () => {
    const res = await aliceClient.app.bsky.actor.createScene({
      handle: 'scene.test',
    })
    scene = res.data
  })

  let invite
  it('invites members to scene', async () => {
    invite = await aliceClient.app.bsky.graph.assertion.create(
      { did: scene.did },
      {
        assertion: 'asdf',
        subject: {
          did: bob.did,
          declarationCid: bob.declarationCid,
        },
        createdAt: new Date().toISOString(),
      },
    )
  })

  it('members accept invites', async () => {
    await bobClient.app.bsky.graph.confirmation.create(
      { did: bob.did },
      {
        originator: {
          did: scene.did,
          declarationCid: scene.declarationCid,
        },
        assertion: {
          uri: invite.uri,
          cid: invite.cid,
        },
        createdAt: new Date().toISOString(),
      },
    )
  })
})
