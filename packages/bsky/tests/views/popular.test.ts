import AtpAgent from '@atproto/api'
import { CloseFn, runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { processAll } from '../_util'

describe('popular views', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let eve: string
  let frank: string

  const account = {
    email: 'blah@test.com',
    password: 'blh-pass',
  }

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'views_popular',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
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
    await processAll(testEnv)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve
    frank = sc.dids.frank
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
    await sc.like(bob, one.ref)
    await sc.like(carol, one.ref)
    await sc.like(dan, one.ref)
    await sc.like(eve, one.ref)
    await sc.like(frank, one.ref)
    const two = await sc.post(bob, 'bobby boi')
    await sc.like(alice, two.ref)
    await sc.like(carol, two.ref)
    await sc.like(dan, two.ref)
    await sc.like(eve, two.ref)
    await sc.like(frank, two.ref)
    const three = await sc.reply(bob, one.ref, one.ref, 'reply')
    await sc.like(alice, three.ref)
    await sc.like(carol, three.ref)
    await sc.like(dan, three.ref)
    await sc.like(eve, three.ref)
    await sc.like(frank, three.ref)
    await processAll(testEnv)

    const res = await agent.api.app.bsky.unspecced.getPopular(
      {},
      { headers: sc.getHeaders(alice, true) },
    )
    const feedUris = res.data.feed.map((i) => i.post.uri).sort()
    const expected = [one.ref.uriStr, two.ref.uriStr, three.ref.uriStr].sort()
    expect(feedUris).toEqual(expected)
  })
})
