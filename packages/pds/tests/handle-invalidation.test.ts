import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AtpAgent } from '@atproto/api'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'

describe('handle invalidation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string

  const mockHandles = {}

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'handle_invalidation',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await userSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob

    const origResolve = network.pds.ctx.idResolver.handle.resolve
    network.pds.ctx.idResolver.handle.resolve = async (handle: string) => {
      if (mockHandles[handle] === null) {
        return undefined
      } else if (mockHandles[handle]) {
        return mockHandles[handle]
      }
      return origResolve(handle)
    }
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not allow for contention of a service handle', async () => {
    const aliceHandle = sc.accounts[alice].handle
    mockHandles[aliceHandle] = bob
    const attempt = agent.api.com.atproto.identity.updateHandle(
      {
        handle: aliceHandle,
      },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Handle already taken: alice.test')

    const aliceRes = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )
    expect(aliceRes.data.handle).toEqual(aliceHandle)

    const bobRes = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      { headers: sc.getHeaders(alice) },
    )
    expect(bobRes.data.handle).toEqual(sc.accounts[bob].handle)
  })

  const HANDLE = 'name.xyz'

  it('allows for contention of an external handle', async () => {
    mockHandles[HANDLE] = alice
    await agent.api.com.atproto.identity.updateHandle(
      {
        handle: HANDLE,
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    mockHandles[HANDLE] = bob
    await agent.api.com.atproto.identity.updateHandle(
      {
        handle: HANDLE,
      },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    const aliceRes = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(alice) },
    )
    expect(aliceRes.data.handle).toEqual('handle.invalid')

    const bobRes = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      { headers: sc.getHeaders(alice) },
    )
    expect(bobRes.data.handle).toEqual(HANDLE)
  })

  it('no longer allows a user to login with a handle they lost due to contention', async () => {
    const attempt = agent.api.com.atproto.server.createSession({
      identifier: HANDLE,
      password: sc.accounts[alice].password,
    })
    await expect(attempt).rejects.toThrow('Invalid identifier or password')
  })
})
