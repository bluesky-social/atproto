import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import { TestNetwork, SeedClient, basicSeed, TestBsync } from '@atproto/dev-env'
import assert from 'assert'

describe('sync mutes', () => {
  let network: TestNetwork
  let bsync: TestBsync
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    assert(process.env.DB_POSTGRES_URL)
    bsync = await TestBsync.create({
      dbSchema: 'bsync_subscription_mutes',
      dbUrl: process.env.DB_POSTGRES_URL,
    })
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_subscription_mutes',
      bsky: {
        bsyncUrl: bsync.url,
        bsyncApiKey: [...bsync.ctx.cfg.auth.apiKeys][0],
        bsyncHttpVersion: '1.1',
        bsyncOnlyMutes: true,
        ingester: {
          bsyncUrl: bsync.url,
          bsyncApiKey: [...bsync.ctx.cfg.auth.apiKeys][0],
          bsyncHttpVersion: '1.1',
        },
      },
    })
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
    await bsync.close()
  })

  it('mutes and unmutes actors.', async () => {
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await processAllMuteOps(network, bsync)
    const { data: mutes1 } = await pdsAgent.api.app.bsky.graph.getMutes(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )
    expect(mutes1.mutes.map((mute) => mute.did)).toEqual([
      sc.dids.dan,
      sc.dids.carol,
      sc.dids.alice,
    ])
    await pdsAgent.api.app.bsky.graph.unmuteActor(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await processAllMuteOps(network, bsync)
    const { data: mutes2 } = await pdsAgent.api.app.bsky.graph.getMutes(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )
    expect(mutes2.mutes.map((mute) => mute.did)).toEqual([
      sc.dids.dan,
      sc.dids.alice,
    ])
  })

  it('mutes and unmutes lists.', async () => {
    // create lists
    const list1 = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: sc.dids.bob },
      {
        name: 'mod list 1',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    const list2 = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: sc.dids.bob },
      {
        name: 'mod list 2',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    const list3 = await pdsAgent.api.app.bsky.graph.list.create(
      { repo: sc.dids.bob },
      {
        name: 'mod list 3',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    await network.processAll()
    await pdsAgent.api.app.bsky.graph.muteActorList(
      { list: list1.uri },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await pdsAgent.api.app.bsky.graph.muteActorList(
      { list: list2.uri },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await pdsAgent.api.app.bsky.graph.muteActorList(
      { list: list3.uri },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await processAllMuteOps(network, bsync)
    const { data: listmutes1 } = await pdsAgent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )
    expect(listmutes1.lists.map((list) => list.uri)).toEqual([
      list3.uri,
      list2.uri,
      list1.uri,
    ])
    await pdsAgent.api.app.bsky.graph.unmuteActorList(
      { list: list2.uri },
      { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
    )
    await processAllMuteOps(network, bsync)
    const { data: listmutes2 } = await pdsAgent.api.app.bsky.graph.getListMutes(
      {},
      { headers: sc.getHeaders(sc.dids.bob) },
    )
    expect(listmutes2.lists.map((list) => list.uri)).toEqual([
      list3.uri,
      list1.uri,
    ])
  })
})

async function processAllMuteOps(network: TestNetwork, bsync: TestBsync) {
  const getBsyncCursor = async () => {
    const result = await bsync.ctx.db.db
      .selectFrom('mute_op')
      .orderBy('id', 'desc')
      .select('id')
      .limit(1)
      .executeTakeFirst()
    return result?.id.toString() ?? null
  }
  assert(network.bsky.ingester.ctx.muteSubscription)
  let total = 0
  while (
    (await getBsyncCursor()) !==
    network.bsky.ingester.ctx.muteSubscription.cursor
  ) {
    if (total > 5000) {
      throw new Error('timeout while processing mute ops')
    }
    await wait(50)
    total += 50
  }
}
