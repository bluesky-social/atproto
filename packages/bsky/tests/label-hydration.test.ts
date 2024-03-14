import { AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import axios from 'axios'

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

  it('hydrates labels based on a supplied labeler header', async () => {
    AtpAgent.configure({ appLabelers: [alice] })
    pdsAgent.configureLabelersHeader([])
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(res.data.labels?.length).toBe(1)
    expect(res.data.labels?.[0].src).toBe(alice)
    expect(res.data.labels?.[0].val).toBe('spam')
    expect(res.headers['atproto-content-labelers']).toEqual(`${alice};redact`)
  })

  it('hydrates labels based on multiple a supplied labelers', async () => {
    AtpAgent.configure({ appLabelers: [bob] })
    pdsAgent.configureLabelersHeader([alice, labelerDid])

    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: sc.getHeaders(bob),
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
    const labelerHeaderDids = res.headers['atproto-content-labelers'].split(',')
    expect(labelerHeaderDids.sort()).toEqual(
      [alice, `${bob};redact`, labelerDid].sort(),
    )
  })

  it('defaults to service labels when no labeler header is provided', async () => {
    const res = await axios.get(
      `${network.pds.url}/xrpc/app.bsky.actor.getProfile?actor=${carol}`,
      { headers: sc.getHeaders(bob) },
    )
    expect(res.data.labels?.length).toBe(1)
    expect(res.data.labels?.[0].src).toBe(labelerDid)
    expect(res.data.labels?.[0].val).toBe('misleading')

    expect(res.headers['atproto-content-labelers']).toEqual(
      network.bsky.ctx.cfg.labelsFromIssuerDids
        .map((did) => `${did};redact`)
        .join(','),
    )
  })

  it('hydrates labels without duplication', async () => {
    AtpAgent.configure({ appLabelers: [alice] })
    pdsAgent.configureLabelersHeader([])
    const res = await pdsAgent.api.app.bsky.actor.getProfiles(
      { actors: [carol, carol] },
      { headers: sc.getHeaders(bob) },
    )
    const { labels = [] } = res.data.profiles[0]
    expect(labels.map((l) => ({ val: l.val, src: l.src }))).toEqual([
      { src: alice, val: 'spam' },
    ])
  })

  it('hydrates labels onto list views.', async () => {
    AtpAgent.configure({ appLabelers: [labelerDid] })
    pdsAgent.configureLabelersHeader([])

    const list = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: alice },
      {
        name: "alice's modlist",
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await network.processAll()
    await createLabel({ uri: list.uri, cid: list.cid, val: 'spam' })
    const res = await pdsAgent.api.app.bsky.graph.getList(
      { list: list.uri },
      { headers: sc.getHeaders(alice) },
    )
    const [label, ...others] = res.data.list.labels ?? []
    expect(label?.src).toBe(labelerDid)
    expect(label?.val).toBe('spam')
    expect(others.length).toBe(0)
  })

  it('hydrates labels onto feed generator views.', async () => {
    const feedgen = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice },
      {
        displayName: "alice's feedgen",
        did: alice,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await network.processAll()
    await createLabel({ uri: feedgen.uri, cid: feedgen.cid, val: 'spam' })
    const res = await pdsAgent.api.app.bsky.feed.getFeedGenerators(
      { feeds: [feedgen.uri] },
      { headers: sc.getHeaders(alice) },
    )
    expect(res.data.feeds.length).toBe(1)
    const [label, ...others] = res.data.feeds[0].labels ?? []
    expect(label?.src).toBe(labelerDid)
    expect(label?.val).toBe('spam')
    expect(others.length).toBe(0)
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
        neg: false,
        src: opts.src ?? labelerDid,
      })
      .execute()
  }
})
