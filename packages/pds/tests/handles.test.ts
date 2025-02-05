import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { IdResolver } from '@atproto/identity'
import { AppContext } from '../src'
import basicSeed from './seeds/basic'

// outside of suite so they can be used in mock
let alice: string
let bob: string

jest.mock('node:dns/promises', () => {
  return {
    resolveTxt: (domain: string) => {
      if (domain === '_atproto.alice.external') {
        return [[`did=${alice}`]]
      }
      if (domain === '_atproto.bob.external') {
        return [[`did=${bob}`]]
      }
      return []
    },
  }
})

describe('handles', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let ctx: AppContext
  let idResolver: IdResolver

  const newHandle = 'alice2.test'

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'handles',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    idResolver = new IdResolver({ plcUrl: ctx.cfg.identity.plcUrl })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await network.close()
  })

  const getHandleFromDb = async (did: string): Promise<string | undefined> => {
    const res = await ctx.accountManager.getAccount(did)
    return res?.handle ?? undefined
  }

  it('resolves handles', async () => {
    const res = await agent.api.com.atproto.identity.resolveHandle({
      handle: 'alice.test',
    })
    expect(res.data.did).toBe(alice)
  })

  it('resolves non-normalize handles', async () => {
    const res = await agent.api.com.atproto.identity.resolveHandle({
      handle: 'aLicE.tEst',
    })
    expect(res.data.did).toBe(alice)
  })

  it('allows a user to change their handle', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      { handle: newHandle },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const attemptOld = agent.api.com.atproto.identity.resolveHandle({
      handle: 'alice.test',
    })
    await expect(attemptOld).rejects.toThrow('Unable to resolve handle')
    const attemptNew = await agent.api.com.atproto.identity.resolveHandle({
      handle: newHandle,
    })
    expect(attemptNew.data.did).toBe(alice)
  })

  it('updates their did document', async () => {
    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe(newHandle)
  })

  it('allows a user to login with their new handle', async () => {
    const res = await agent.api.com.atproto.server.createSession({
      identifier: newHandle,
      password: sc.accounts[alice].password,
    })
    sc.accounts[alice].accessJwt = res.data.accessJwt
    sc.accounts[alice].refreshJwt = res.data.refreshJwt
  })

  it('does not allow taking a handle that already exists', async () => {
    const attempt = agent.api.com.atproto.identity.updateHandle(
      { handle: 'Bob.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Handle already taken: bob.test')
  })

  it('handle updates are idempotent', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      { handle: 'Bob.test' },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })

  it('if handle update fails, it does not update their did document', async () => {
    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe(newHandle)
  })

  it('disallows improperly formatted handles', async () => {
    const tryHandle = async (handle: string) => {
      await agent.api.com.atproto.identity.updateHandle(
        { handle },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
    }
    await expect(tryHandle('did:john')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('john.bsky.io')).rejects.toThrow(
      'External handle did not resolve to DID',
    )
    await expect(tryHandle('j.test')).rejects.toThrow('Handle too short')
    await expect(tryHandle('jayromy-johnber12345678910.test')).rejects.toThrow(
      'Handle too long',
    )
    await expect(tryHandle('jo_hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo!hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo%hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo&hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo*hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo|hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo:hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('jo/hn.test')).rejects.toThrow(
      'Input/handle must be a valid handle',
    )
    await expect(tryHandle('about.test')).rejects.toThrow('Reserved handle')
    await expect(tryHandle('atp.test')).rejects.toThrow('Reserved handle')
  })

  it('allows updating to a dns handles', async () => {
    await agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'alice.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const dbHandle = await getHandleFromDb(alice)
    expect(dbHandle).toBe('alice.external')

    const data = await idResolver.did.resolveAtprotoData(alice)
    expect(data.handle).toBe('alice.external')
  })

  it('does not allow updating to an invalid dns handle', async () => {
    const attempt = agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'bob.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow(
      'External handle did not resolve to DID',
    )

    const attempt2 = agent.api.com.atproto.identity.updateHandle(
      {
        handle: 'noexist.external',
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt2).rejects.toThrow(
      'External handle did not resolve to DID',
    )

    const dbHandle = await getHandleFromDb(alice)
    expect(dbHandle).toBe('alice.external')
  })

  it('allows admin overrules of service domains', async () => {
    await agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    const dbHandle = await getHandleFromDb(bob)
    expect(dbHandle).toBe('bob-alt.test')
  })

  it('allows admin override of reserved domains', async () => {
    await agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'dril.test',
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
    )

    const dbHandle = await getHandleFromDb(bob)
    expect(dbHandle).toBe('dril.test')
  })

  it('requires admin auth', async () => {
    const attempt = agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: sc.getHeaders(bob),
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('Authentication Required')
    const attempt2 = agent.api.com.atproto.admin.updateAccountHandle({
      did: bob,
      handle: 'bob-alt.test',
    })
    await expect(attempt2).rejects.toThrow('Authentication Required')
  })
})
