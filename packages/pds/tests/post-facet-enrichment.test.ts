import { AppBskyFeedPost, type AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

// End-to-end coverage for the opt-in PDS_ENRICH_POST_FACETS behavior: a post
// created via com.atproto.repo.createRecord with only { text, createdAt } should
// come back with server-detected facets when the flag is on.
describe('opt-in server-side post facet enrichment', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let did: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'post_facet_enrichment',
      pds: { enrichPostFacets: true },
    })
    agent = network.pds.getAgent()
    await agent.createAccount({
      email: 'facets@test.com',
      handle: 'facets.test',
      password: 'facets-pass',
    })
    did = agent.assertDid
  })

  afterAll(async () => {
    await network?.close()
  })

  const createPost = async (record: Record<string, unknown>) => {
    const res = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: { $type: 'app.bsky.feed.post', ...record },
    })
    const got = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      rkey: res.data.uri.split('/').pop() as string,
    })
    return got.data.value as AppBskyFeedPost.Record
  }

  it('populates facets for a bare { text } post', async () => {
    const value = await createPost({
      text: 'hello #world see https://atproto.com',
      createdAt: new Date().toISOString(),
    })
    expect(value.facets?.length).toBeGreaterThan(0)
    const types = (value.facets ?? []).map((f) => f.features[0].$type)
    expect(types).toContain('app.bsky.richtext.facet#tag')
    expect(types).toContain('app.bsky.richtext.facet#link')
  })

  it('resolves a mention of a real account to its DID', async () => {
    const value = await createPost({
      text: 'talking to @facets.test today',
      createdAt: new Date().toISOString(),
    })
    const mention = (value.facets ?? []).find(
      (f) => f.features[0].$type === 'app.bsky.richtext.facet#mention',
    )
    expect(mention).toBeDefined()
    expect((mention?.features[0] as { did: string }).did).toBe(did)
  })

  it('leaves a post that already supplies facets untouched', async () => {
    const supplied = [
      {
        index: { byteStart: 0, byteEnd: 6 },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'world' }],
      },
    ]
    const value = await createPost({
      text: '#world and also example.com',
      facets: supplied,
      createdAt: new Date().toISOString(),
    })
    // untouched: still exactly the one facet the client supplied
    expect(value.facets).toHaveLength(1)
    expect(value.facets?.[0].features[0].$type).toBe(
      'app.bsky.richtext.facet#tag',
    )
  })

  it('adds no facets to plain text', async () => {
    const value = await createPost({
      text: 'just some plain words',
      createdAt: new Date().toISOString(),
    })
    expect(value.facets).toBeUndefined()
  })
})
