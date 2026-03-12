import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { MST, def } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { AppContext } from '../src/context'

type PreorderRow = { lpath: string; depth: number; cid: string }

// Full preorder traversal of the MST, producing the expected preorder_map rows.
async function computeExpectedRows(
  node: MST,
  lpath: string,
  layer: number,
): Promise<PreorderRow[]> {
  const rows: PreorderRow[] = []
  rows.push({
    lpath,
    depth: 129 - layer,
    cid: (await node.getPointer()).toString(),
  })
  const entries = await node.getEntries()
  let currentLpath = lpath
  for (const entry of entries) {
    if (entry.isLeaf()) {
      rows.push({
        lpath: entry.key,
        depth: 0,
        cid: entry.value.toString(),
      })
      currentLpath = entry.key
    } else {
      const childLayer = (await entry.getLayer()) ?? layer - 1
      const childRows = await computeExpectedRows(
        entry,
        currentLpath,
        childLayer,
      )
      rows.push(...childRows)
    }
  }
  return rows
}

describe('preorder map', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'preorder_map',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    await agent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  const verifyPreorderMap = async () => {
    const did = agent.accountDid
    await ctx.actorStore.read(did, async (store) => {
      // Read actual preorder_map rows from the DB
      const actual = await store.repo.storage.db.db
        .selectFrom('preorder_map')
        .selectAll()
        .orderBy('lpath')
        .orderBy('depth')
        .execute()

      // Compute expected rows from MST traversal
      const root = await store.repo.storage.getRootDetailed()
      const commit = await store.repo.storage.readObj(
        root.cid,
        def.versionedCommit,
      )
      const mst = MST.load(store.repo.storage, commit.data)
      const layer = await mst.getLayer()
      const expected = await computeExpectedRows(mst, '', layer)
      expected.sort((a, b) =>
        a.lpath < b.lpath ? -1 : a.lpath > b.lpath ? 1 : a.depth - b.depth,
      )

      expect(actual).toEqual(expected)
    })
  }

  it('is correct after account creation', async () => {
    await verifyPreorderMap()
  })

  it('is correct after creating records', async () => {
    for (let i = 0; i < 10; i++) {
      await agent.api.com.atproto.repo.createRecord({
        repo: agent.accountDid,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: `Post number ${i}`,
          createdAt: new Date().toISOString(),
        },
      })
    }
    await verifyPreorderMap()
  })

  it('is correct after updating records', async () => {
    const list = await agent.api.com.atproto.repo.listRecords({
      repo: agent.accountDid,
      collection: 'app.bsky.feed.post',
      limit: 5,
    })
    for (const rec of list.data.records) {
      await agent.api.com.atproto.repo.putRecord({
        repo: agent.accountDid,
        collection: 'app.bsky.feed.post',
        rkey: new AtUri(rec.uri).rkey,
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Updated text',
          createdAt: new Date().toISOString(),
        },
      })
    }
    await verifyPreorderMap()
  })

  it('is correct after deleting records', async () => {
    const list = await agent.api.com.atproto.repo.listRecords({
      repo: agent.accountDid,
      collection: 'app.bsky.feed.post',
      limit: 3,
    })
    for (const rec of list.data.records) {
      await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.accountDid,
        collection: 'app.bsky.feed.post',
        rkey: new AtUri(rec.uri).rkey,
      })
    }
    await verifyPreorderMap()
  })

  it('is correct after mixed operations', async () => {
    // Create more records across different collections
    for (let i = 0; i < 5; i++) {
      await agent.api.com.atproto.repo.createRecord({
        repo: agent.accountDid,
        collection: 'app.bsky.feed.like',
        record: {
          $type: 'app.bsky.feed.like',
          subject: {
            uri: `at://did:plc:fake/app.bsky.feed.post/fake${i}`,
            cid: 'bafyreie5cvv4h45feadgeuwhbcutmh6t7ceseocckahdoe6uat64zmz454',
          },
          createdAt: new Date().toISOString(),
        },
      })
    }
    // Delete some posts
    const posts = await agent.api.com.atproto.repo.listRecords({
      repo: agent.accountDid,
      collection: 'app.bsky.feed.post',
      limit: 2,
    })
    for (const rec of posts.data.records) {
      await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.accountDid,
        collection: 'app.bsky.feed.post',
        rkey: new AtUri(rec.uri).rkey,
      })
    }
    await verifyPreorderMap()
  })
})
