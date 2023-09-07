import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot, paginateAll, stripViewerFromPost } from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  let listRef: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_author_feed',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    listRef = await sc.createList(alice, 'test list', 'curate')
    await sc.addToList(alice, alice, listRef)
    await sc.addToList(alice, bob, listRef)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches list feed', async () => {
    const res = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      { headers: await network.serviceHeaders(carol) },
    )
    expect(forSnapshot(res.data.feed)).toMatchSnapshot()

    // all posts are from alice or bob
    expect(
      res.data.feed.every((row) => [alice, bob].includes(row.post.author.did)),
    ).toBeTruthy()
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getListFeed(
        {
          list: listRef.uriStr,
          cursor,
          limit: 2,
        },
        { headers: await network.serviceHeaders(carol) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches results unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getListFeed(
      { list: listRef.uriStr },
      { headers: await network.serviceHeaders(alice) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getListFeed({
      list: listRef.uriStr,
    })
    expect(unauthed.feed.length).toBeGreaterThan(0)
    expect(unauthed.feed).toEqual(
      authed.feed.map((item) => {
        const result = {
          ...item,
          post: stripViewerFromPost(item.post),
        }
        if (item.reply) {
          result.reply = {
            parent: stripViewerFromPost(item.reply.parent),
            root: stripViewerFromPost(item.reply.root),
          }
        }
        return result
      }),
    )
  })

  it('works for empty lists', async () => {
    const emptyList = await sc.createList(alice, 'empty list', 'curate')
    const res = await agent.api.app.bsky.feed.getListFeed({
      list: emptyList.uriStr,
    })

    expect(res.data.feed.length).toEqual(0)
  })
})
