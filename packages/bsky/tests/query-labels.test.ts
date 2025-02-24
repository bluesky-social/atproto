import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'

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
      dbPostgresSchema: 'bsky_query_labels',
    })
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    labelerDid = network.bsky.ctx.cfg.labelsFromIssuerDids[0]
    await createLabel({ src: alice, uri: carol, cid: '', val: 'spam' })
    await createLabel({ src: bob, uri: carol, cid: '', val: 'impersonation' })
    await createLabel({
      src: labelerDid,
      uri: carol,
      cid: '',
      val: 'misleading',
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns labels based for a subject', async () => {
    const { data } = await pdsAgent.api.com.atproto.label.queryLabels(
      { uriPatterns: [carol], sources: [alice] },
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(data.labels?.length).toBe(1)
    expect(data.labels?.[0].src).toBe(alice)
    expect(data.labels?.[0].val).toBe('spam')
  })

  it('returns labels from supplied labelers as param', async () => {
    const { data } = await pdsAgent.api.com.atproto.label.queryLabels(
      { uriPatterns: [carol], sources: [alice, labelerDid] },
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(data.labels?.length).toBe(2)
    expect(data.labels?.find((l) => l.src === alice)?.val).toEqual('spam')
    expect(data.labels?.find((l) => l.src === labelerDid)?.val).toEqual(
      'misleading',
    )
  })

  const createLabel = async (opts: {
    src?: string
    uri: string
    cid: string
    val: string
  }) => {
    await network.bsky.db.db
      .insertInto('label')
      .values({
        uri: opts.uri,
        cid: opts.cid,
        val: opts.val,
        cts: new Date().toISOString(),
        exp: null,
        neg: false,
        src: opts.src ?? labelerDid,
      })
      .execute()
  }
})
