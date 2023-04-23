import AtpAgent from '@atproto/api'
import { DidResolver } from '@atproto/did-resolver'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import * as util from './_util'
import { AppContext } from '../src'
import { moderatorAuth } from './_util'

// outside of suite so they can be used in mock
let alice: string
let bob: string

jest.mock('dns/promises', () => {
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
  let agent: AtpAgent
  let close: util.CloseFn
  let sc: SeedClient
  let ctx: AppContext
  let didResolver: DidResolver

  const newHandle = 'alice2.test'

  beforeAll(async () => {
    const server = await util.runTestServer({
      dbPostgresSchema: 'handles',
    })
    ctx = server.ctx
    didResolver = new DidResolver({ plcUrl: ctx.cfg.didPlcUrl })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await close()
  })

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

  it('does not resolve a "handle" for the service', async () => {
    const promise = agent.api.com.atproto.identity.resolveHandle()
    await expect(promise).rejects.toThrow('Unable to resolve handle')
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
    const data = await didResolver.resolveAtprotoData(alice)
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

  it('returns the correct handle in views', async () => {
    const profile = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )
    expect(profile.data.handle).toBe(newHandle)

    const timeline = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(bob) },
    )

    const alicePosts = timeline.data.feed.filter(
      (post) => post.post.author.did === alice,
    )
    for (const post of alicePosts) {
      expect(post.post.author.handle).toBe(newHandle)
    }

    const followers = await agent.api.app.bsky.graph.getFollowers(
      { actor: bob },
      { headers: sc.getHeaders(bob) },
    )

    const aliceFollows = followers.data.followers.filter((f) => f.did === alice)
    expect(aliceFollows.length).toBe(1)
    expect(aliceFollows[0].handle).toBe(newHandle)
  })

  it('does not allow taking a handle that already exists', async () => {
    const attempt = agent.api.com.atproto.identity.updateHandle(
      { handle: 'Bob.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Handle already taken: bob.test')
  })

  it('if handle update fails, it does not update their did document', async () => {
    const data = await didResolver.resolveAtprotoData(alice)
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
    const profile = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )
    expect(profile.data.handle).toBe('alice.external')

    const data = await didResolver.resolveAtprotoData(alice)
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

    const profile = await agent.api.app.bsky.actor.getProfile(
      { actor: alice },
      { headers: sc.getHeaders(bob) },
    )
    expect(profile.data.handle).toBe('alice.external')
  })

  it('allows admin overrules of service domains', async () => {
    await agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )

    const profile = await agent.api.app.bsky.actor.getProfile(
      { actor: bob },
      { headers: sc.getHeaders(bob) },
    )
    expect(profile.data.handle).toBe('bob-alt.test')
  })

  it('disallows admin overrules of off-service domains', async () => {
    const attempt = agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: alice,
        handle: 'alice-alt.test',
      },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow(
      'Account not on an available service domain: alice.external',
    )
  })

  it('disallows setting handle to an off-service domain', async () => {
    const attempt = agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob.external',
      },
      {
        headers: { authorization: util.adminAuth() },
        encoding: 'application/json',
      },
    )
    await expect(attempt).rejects.toThrow('Unsupported domain')
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
    const attempt3 = agent.api.com.atproto.admin.updateAccountHandle(
      {
        did: bob,
        handle: 'bob-alt.test',
      },
      {
        headers: { authorization: moderatorAuth() },
        encoding: 'application/json',
      },
    )
    await expect(attempt3).rejects.toThrow('Authentication Required')
  })
})
