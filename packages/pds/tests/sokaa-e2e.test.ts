import { SeedClient, TestNetworkSokaa, usersSeed } from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'

jest.setTimeout(120_000)

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function uploadImage(
  network: TestNetworkSokaa,
  did: string,
  sc: SeedClient,
): Promise<{ ref: { $link: string }; mimeType: string; size: number }> {
  const agent = network.pds.getClient()
  const res = await agent.com.atproto.repo.uploadBlob(PNG_1X1, {
    encoding: 'image/png',
    headers: sc.getHeaders(did),
  })
  const blob = res.data.blob
  return {
    ref: blob.ref,
    mimeType: blob.mimeType,
    size: blob.size,
  }
}

async function createSokaaPost(
  network: TestNetworkSokaa,
  did: string,
  sc: SeedClient,
  caption: string,
): Promise<string> {
  const image = await uploadImage(network, did, sc)
  const agent = network.pds.getClient()
  const res = await agent.com.atproto.repo.createRecord(
    {
      repo: did,
      collection: 'app.sokaa.feed.post',
      record: {
        $type: 'app.sokaa.feed.post',
        caption,
        media: {
          $type: 'app.sokaa.embed.images',
          images: [{ alt: 'test', image }],
        },
        createdAt: new Date().toISOString(),
      },
    },
    { headers: sc.getHeaders(did) },
  )
  return res.data.uri
}

async function fetchTimeline(
  network: TestNetworkSokaa,
  did: string,
  sc: SeedClient,
) {
  const res = await fetch(
    `${network.pds.url}/xrpc/app.sokaa.feed.getTimeline?limit=50`,
    { headers: sc.getHeaders(did) },
  )
  expect(res.status).toBe(200)
  return res.json() as Promise<{
    feed: Array<{
      post: {
        uri: string
        record: { caption?: string }
        likeCount?: number
        viewer?: { like?: string }
      }
    }>
  }>
}

async function waitForCaption(
  network: TestNetworkSokaa,
  did: string,
  sc: SeedClient,
  caption: string,
  timeoutMs = 30000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const data = await fetchTimeline(network, did, sc)
    const match = data.feed.find((item) => item.post.record.caption === caption)
    if (match) return match
    await network.processAll()
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timed out waiting for timeline caption: ${caption}`)
}

describe('Sokaa AppView via PDS proxy (TestNetworkSokaa)', () => {
  let network: TestNetworkSokaa
  let sc: SeedClient
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetworkSokaa.create({
      dbPostgresSchema: 'sokaa_e2e',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('getTimeline returns own post after firehose indexing', async () => {
    const caption = `alice-post-${Date.now()}`
    await createSokaaPost(network, alice, sc, caption)
    await network.processAll()

    const item = await waitForCaption(network, alice, sc, caption)
    expect(item.post.uri).toMatch(/^at:\/\//)
  })

  it('getProfile returns actor via PDS proxy', async () => {
    const res = await fetch(
      `${network.pds.url}/xrpc/app.sokaa.actor.getProfile?actor=${alice}`,
      { headers: sc.getHeaders(alice) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { did: string; handle?: string }
    expect(body.did).toBe(alice)
    expect(body.handle).toBe('alice.test')
  })

  it('getAuthorFeed lists author posts via PDS proxy', async () => {
    const caption = `author-feed-${Date.now()}`
    await createSokaaPost(network, bob, sc, caption)
    await network.processAll()
    await waitForCaption(network, bob, sc, caption)

    const res = await fetch(
      `${network.pds.url}/xrpc/app.sokaa.feed.getAuthorFeed?actor=${bob}&limit=10`,
      { headers: sc.getHeaders(bob) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      feed: Array<{ post: { record: { caption?: string } } }>
    }
    expect(body.feed.some((item) => item.post.record.caption === caption)).toBe(
      true,
    )
  })

  it('getTimeline includes followed author posts and like aggregation', async () => {
    const caption = `followed-post-${Date.now()}`
    const agent = network.pds.getClient()

    await agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.sokaa.graph.follow',
        record: {
          $type: 'app.sokaa.graph.follow',
          subject: bob,
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice) },
    )
    const postUri = await createSokaaPost(network, bob, sc, caption)
    await network.processAll()
    await waitForCaption(network, alice, sc, caption)

    const { data: postRecord } = await agent.com.atproto.repo.getRecord({
      repo: bob,
      collection: 'app.sokaa.feed.post',
      rkey: new AtUri(postUri).rkey,
    })

    await agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.sokaa.feed.like',
        record: {
          $type: 'app.sokaa.feed.like',
          subject: { uri: postUri, cid: postRecord.cid },
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice) },
    )
    await network.processAll()

    const liked = await waitForCaption(network, alice, sc, caption)
    expect(liked.post.viewer?.like).toBeTruthy()
    expect(liked.post.likeCount).toBeGreaterThanOrEqual(1)
  })

  it('resumes firehose cursor after subscription restart', async () => {
    const caption = `after-restart-${Date.now()}`
    await createSokaaPost(network, bob, sc, caption)
    await network.processAll()
    await waitForCaption(network, bob, sc, caption)

    await network.sokaa.sub.destroy()
    await network.sokaa.sub.restart()
    await network.processAll()

    const caption2 = `after-restart-2-${Date.now()}`
    await createSokaaPost(network, alice, sc, caption2)
    await network.processAll()
    await waitForCaption(network, alice, sc, caption2)
  })
})
