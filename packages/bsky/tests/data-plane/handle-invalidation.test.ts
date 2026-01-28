import { DAY } from '@atproto/common'
import { SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { Client, DidString } from '@atproto/lex'
import { app, com } from '../../src/lexicons/index.js'

describe('handle invalidation', () => {
  let network: TestNetwork
  let client: Client
  let pdsAgent: Client
  let sc: SeedClient
  let alice: DidString
  let bob: DidString

  const mockHandles = {}

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_handle_invalidation',
    })
    client = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob

    const origResolve = network.bsky.dataplane.idResolver.handle.resolve
    network.bsky.dataplane.idResolver.handle.resolve = async (
      handle: string,
    ) => {
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

  const backdateIndexedAt = async (did: string) => {
    const TWO_DAYS_AGO = new Date(Date.now() - 2 * DAY).toISOString()
    await network.bsky.db.db
      .updateTable('actor')
      .set({ indexedAt: TWO_DAYS_AGO })
      .where('did', '=', did)
      .execute()
  }

  it('indexes an account with no proper handle', async () => {
    mockHandles['eve.test'] = null
    const eveAccnt = await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@test.com',
      password: 'eve-pass',
    })
    await network.processAll()

    const res = await client.call(
      app.bsky.actor.getProfile,
      { actor: eveAccnt.did },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.actor.getProfile.$lxm,
        ),
      },
    )
    expect(res.handle).toEqual('handle.invalid')
  })

  it('invalidates out of date handles', async () => {
    await backdateIndexedAt(alice)

    const aliceHandle = sc.accounts[alice].handle
    // alice's handle no longer resolves
    mockHandles[aliceHandle] = null
    await sc.post(alice, 'blah')
    await network.processAll()
    const res = await client.call(
      app.bsky.actor.getProfile,
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.actor.getProfile.$lxm,
        ),
      },
    )
    expect(res.handle).toEqual('handle.invalid')
  })

  it('revalidates an out of date handle', async () => {
    await backdateIndexedAt(alice)
    const aliceHandle = sc.accounts[alice].handle
    // alice's handle no longer resolves
    delete mockHandles[aliceHandle]

    await sc.post(alice, 'blah')
    await network.processAll()
    const res = await client.call(
      app.bsky.actor.getProfile,
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.actor.getProfile.$lxm,
        ),
      },
    )
    expect(res.handle).toEqual(sc.accounts[alice].handle)
  })

  it('deals with handle contention', async () => {
    await backdateIndexedAt(bob)
    // update alices handle so that the pds will let bob take her old handle
    await network.pds.ctx.accountManager.updateHandle(alice, 'not-alice.test')

    await pdsAgent.call(
      com.atproto.identity.updateHandle,
      {
        handle: sc.accounts[alice].handle,
      },
      { headers: sc.getHeaders(bob) },
    )
    await network.processAll()

    const aliceRes = await client.call(
      app.bsky.actor.getProfile,
      { actor: alice },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.actor.getProfile.$lxm,
        ),
      },
    )
    expect(aliceRes.handle).toEqual('handle.invalid')

    const bobRes = await client.call(
      app.bsky.actor.getProfile,
      { actor: bob },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.actor.getProfile.$lxm,
        ),
      },
    )
    expect(bobRes.handle).toEqual(sc.accounts[alice].handle)
  })
})
