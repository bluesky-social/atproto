import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds follow views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  afterAll(async () => {
    await close()
  })

  it('fetches followers', async () => {
    const view = await client.todo.social.getUserFollowers({
      user: 'alice.test',
    })
    expect(view.data.subject.did).toEqual(alice)
    expect(view.data.subject.name).toEqual(sc.accounts[alice].username)
    expect(view.data.subject.displayName).toEqual(
      sc.profiles[alice].displayName,
    )
    const bobFollow = view.data.followers.find(
      (f) => f.name === sc.accounts[bob].username,
    )
    expect(bobFollow?.did).toEqual(bob)
    expect(bobFollow?.name).toEqual(sc.accounts[bob].username)
    expect(bobFollow?.displayName).toEqual(sc.profiles[bob].displayName)
    expect(bobFollow?.createdAt).toBeDefined()
    expect(bobFollow?.indexedAt).toBeDefined()
    const carolFollow = view.data.followers.find(
      (f) => f.name === sc.accounts[carol].username,
    )
    expect(carolFollow?.did).toEqual(carol)
    expect(carolFollow?.name).toEqual(sc.accounts[carol].username)
    expect(carolFollow?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches follows', async () => {
    const view = await client.todo.social.getUserFollows({
      user: 'bob.test',
    })
    expect(view.data.subject.did).toEqual(bob)
    expect(view.data.subject.name).toEqual(sc.accounts[bob].username)
    expect(view.data.subject.displayName).toEqual(sc.profiles[bob].displayName)
    const aliceFollow = view.data.follows.find(
      (f) => f.name === sc.accounts[alice].username,
    )
    expect(aliceFollow?.did).toEqual(alice)
    expect(aliceFollow?.name).toEqual(sc.accounts[alice].username)
    expect(aliceFollow?.displayName).toEqual(sc.profiles[alice].displayName)
    expect(aliceFollow?.createdAt).toBeDefined()
    expect(aliceFollow?.indexedAt).toBeDefined()
    const carolFollow = view.data.follows.find(
      (f) => f.name === sc.accounts[carol].username,
    )
    expect(carolFollow?.did).toEqual(carol)
    expect(carolFollow?.name).toEqual(sc.accounts[carol].username)
    expect(carolFollow?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })
})
