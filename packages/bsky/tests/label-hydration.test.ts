import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { MINUTE } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'

describe('label hydration', () => {
  let network: TestNetwork
  let pdsAgent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string
  let carol: string
  let labelerDid: string
  let labeler2Did: string

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
    labeler2Did = network.bsky.ctx.cfg.labelsFromIssuerDids[1]
    await createLabel({ src: alice, uri: carol, cid: '', val: 'spam' })
    await createLabel({ src: bob, uri: carol, cid: '', val: 'impersonation' })
    await createLabel({
      src: labelerDid,
      uri: carol,
      cid: '',
      val: 'misleading',
    })
    await createLabel({
      src: labeler2Did,
      uri: carol,
      cid: '',
      val: 'expired',
      exp: new Date(Date.now() - MINUTE).toISOString(),
    })
    await createLabel({
      src: labeler2Did,
      uri: carol,
      cid: '',
      val: 'not-expired',
      exp: new Date(Date.now() + MINUTE).toISOString(),
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('hydrates labels based on a supplied labeler header', async () => {
    AtpAgent.configure({ appLabelers: [alice] })
    pdsAgent.configureLabelers([labeler2Did])
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(res.data.labels?.length).toBe(2)
    assert(res.data.labels)

    const sortedLabels = res.data.labels.sort((a, b) =>
      a.src.localeCompare(b.src),
    )
    const sortedExpected = [
      { src: labeler2Did, val: 'not-expired' },
      { src: alice, val: 'spam' },
    ].sort((a, b) => a.src.localeCompare(b.src))

    expect(sortedLabels[0].src).toBe(sortedExpected[0].src)
    expect(sortedLabels[0].val).toBe(sortedExpected[0].val)

    expect(sortedLabels[1].src).toBe(sortedExpected[1].src)
    expect(sortedLabels[1].val).toBe(sortedExpected[1].val)

    expect(res.headers['atproto-content-labelers']).toEqual(
      `${alice};redact,${labeler2Did}`,
    )
  })

  it('hydrates labels based on multiple a supplied labelers', async () => {
    AtpAgent.configure({ appLabelers: [bob] })
    pdsAgent.configureLabelers([alice])

    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      {
        headers: {
          'atproto-accept-labelers': labelerDid,
          ...sc.getHeaders(bob),
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
    const labelerHeaderDids = res.headers['atproto-content-labelers']
      ?.split(',')
      .sort()

    expect(labelerHeaderDids).toEqual(
      [alice, `${bob};redact`, labelerDid].sort(),
    )
  })

  it('defaults to service labels when no labeler header is provided', async () => {
    const res = await fetch(
      `${network.pds.url}/xrpc/app.bsky.actor.getProfile?actor=${carol}`,
      { headers: sc.getHeaders(bob) },
    )
    const data = await res.json()

    expect(data.labels?.length).toBe(2)
    assert(data.labels)

    const sortedLabels = data.labels.sort((a, b) => a.src.localeCompare(b.src))
    const sortedExpected = [
      { src: labeler2Did, val: 'not-expired' },
      { src: labelerDid, val: 'misleading' },
    ].sort((a, b) => a.src.localeCompare(b.src))

    expect(sortedLabels[0].src).toBe(sortedExpected[0].src)
    expect(sortedLabels[0].val).toBe(sortedExpected[0].val)

    expect(sortedLabels[1].src).toBe(sortedExpected[1].src)
    expect(sortedLabels[1].val).toBe(sortedExpected[1].val)

    expect(res.headers.get('atproto-content-labelers')).toEqual(
      network.bsky.ctx.cfg.labelsFromIssuerDids
        .map((did) => `${did};redact`)
        .join(','),
    )
  })

  it('hydrates labels without duplication', async () => {
    AtpAgent.configure({ appLabelers: [alice] })
    pdsAgent.configureLabelers([])
    const res = await pdsAgent.api.app.bsky.actor.getProfiles(
      { actors: [carol, carol] },
      { headers: sc.getHeaders(bob) },
    )
    const { labels = [] } = res.data.profiles[0]
    expect(labels.map((l) => ({ val: l.val, src: l.src }))).toEqual([
      { src: alice, val: 'spam' },
    ])
  })

  it('does not hydrate labels from takendown labeler', async () => {
    AtpAgent.configure({ appLabelers: [alice, sc.dids.dan] })
    pdsAgent.configureLabelers([])
    await network.bsky.ctx.dataplane.takedownActor({ did: alice })
    const res = await pdsAgent.api.app.bsky.actor.getProfile(
      { actor: carol },
      { headers: sc.getHeaders(bob) },
    )
    const { labels = [] } = res.data
    expect(labels).toEqual([])
    expect(res.headers['atproto-content-labelers']).toEqual(
      `${sc.dids.dan};redact`, // does not include alice
    )
    await network.bsky.ctx.dataplane.untakedownActor({ did: alice })
  })

  it('hydrates labels onto list views.', async () => {
    AtpAgent.configure({ appLabelers: [labelerDid] })
    pdsAgent.configureLabelers([])

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
    exp?: string
  }) => {
    await network.bsky.db.db
      .insertInto('label')
      .values({
        uri: opts.uri,
        cid: opts.cid,
        val: opts.val,
        cts: new Date().toISOString(),
        exp: opts.exp ?? null,
        neg: false,
        src: opts.src ?? labelerDid,
      })
      .execute()
  }
})
