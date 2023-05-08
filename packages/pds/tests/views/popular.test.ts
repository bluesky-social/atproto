import AtpAgent from '@atproto/api'
import { runTestServer, CloseFn, TestServerInfo } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('popular views', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  const account = {
    email: 'blah@test.com',
    password: 'blh-pass',
  }

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_popular',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)

    await sc.createAccount('eve', {
      ...account,
      email: 'eve@test.com',
      handle: 'eve.test',
      password: 'eve-pass',
    })
    await sc.createAccount('frank', {
      ...account,
      email: 'frank@test.com',
      handle: 'frank.test',
      password: 'frank-pass',
    })
    await sc.createAccount('george', {
      ...account,
      email: 'george@test.com',
      handle: 'george.test',
      password: 'george-pass',
    })
    await sc.createAccount('helen', {
      ...account,
      email: 'helen@test.com',
      handle: 'helen.test',
      password: 'helen-pass',
    })

    alice = sc.dids.alice
    bob = sc.dids.bob
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('returns well liked posts', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const one = await sc.post(alice, 'first post', undefined, [img])
    const two = await sc.post(bob, 'bobby boi')
    const three = await sc.reply(bob, one.ref, one.ref, 'reply')

    for (let i = 0; i < 12; i++) {
      const name = `user${i}`
      await sc.createAccount(name, {
        handle: `user${i}.test`,
        email: `user${i}@test.com`,
        password: 'password',
      })
      await sc.like(sc.dids[name], one.ref)
      await sc.like(sc.dids[name], two.ref)
      await sc.like(sc.dids[name], three.ref)
    }
    await server.ctx.backgroundQueue.processAll()

    const res = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(alice) },
    )
    const feedUris = res.data.feed.map((i) => i.post.uri).sort()
    const expected = [one.ref.uriStr, two.ref.uriStr].sort()
    expect(feedUris).toEqual(expected)
  })

  it('does not return muted posts', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: bob },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const res = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(alice) },
    )
    expect(res.data.feed.length).toBe(1)
    const dids = res.data.feed.map((post) => post.post.author.did)
    expect(dids.includes(bob)).toBe(false)
  })
})
