import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'

describe('label hydration', () => {
  let network: TestNetwork
  let pdsAgent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let labelerDid: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_label_hydration',
    })
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    labelerDid = network.bsky.ctx.cfg.labelsFromIssuerDids[0]
    await network.bsky.db.db
      .insertInto('label')
      .values([
        {
          src: alice,
          uri: carol,
          cid: '',
          val: 'spam',
          neg: false,
          cts: new Date().toISOString(),
        },
        {
          src: bob,
          uri: carol,
          cid: '',
          val: 'impersonation',
          neg: false,
          cts: new Date().toISOString(),
        },
        {
          src: labelerDid,
          uri: carol,
          cid: '',
          val: 'misleading',
          neg: false,
          cts: new Date().toISOString(),
        },
      ])
      .execute()
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('hydrates labels based on a supplied labeler header', async () => {
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: { ...sc.getHeaders(bob), 'atproto-labelers': alice } },
    )
    expect(res.data.labels?.length).toBe(1)
    expect(res.data.labels?.[0].src).toBe(alice)
    expect(res.data.labels?.[0].val).toBe('spam')
  })

  it('hydrates labels based on multiple a supplied labelers', async () => {
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: {
          ...sc.getHeaders(bob),
          'atproto-labelers': `${alice},${bob}, ${labelerDid}`,
        },
      },
    )
    expect(res.data.labels?.length).toBe(3)
    expect(res.data.labels?.find((l) => l.src === alice)?.val).toEqual('spam')
    expect(res.data.labels?.find((l) => l.src === bob)?.val).toEqual(
      'impersonation',
    )
    expect(res.data.labels?.find((l) => l.src === labelerDid)?.val).toEqual(
      'misleading',
    )
  })

  it('defaults to service labels when no labeler header is provided', async () => {
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: sc.getHeaders(bob) },
    )
    expect(res.data.labels?.length).toBe(1)
    expect(res.data.labels?.[0].src).toBe(labelerDid)
    expect(res.data.labels?.[0].val).toBe('misleading')
  })
})
