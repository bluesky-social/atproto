import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import { Gate } from '../../src/feature-gates/gates.js'

type FeedItemWithOpThreadMetadata = {
  post: { uri: string }
  opThreadPostIndex?: number
  opThreadPostCount?: number
}

describe('OP thread feed metadata', () => {
  let network: TestNetwork
  let sc: SeedClient<TestNetwork>

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_op_thread_feed_metadata',
    })
    vi.spyOn(network.bsky.ctx.featureGatesClient, 'scope').mockReturnValue({
      Gate,
      checkGate: (gate) => gate === Gate.OpThreadMetadataEnable,
      checkGates: (gates) =>
        new Map(
          gates.map((gate) => [gate, gate === Gate.OpThreadMetadataEnable]),
        ),
    })
    sc = network.getSeedClient()
    await sc.createAccount('threadop', {
      handle: 'threadop.test',
      email: 'threadop@test.com',
      password: 'threadop-pass',
    })
    await network.processAll()
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await network?.close()
  })

  it('exposes canonical numbering on feed items', async () => {
    const op = sc.dids.threadop
    const root = await sc.post(op, 'root')
    const first = await sc.reply(op, root.ref, root.ref, 'first')
    const second = await sc.reply(op, root.ref, first.ref, 'second')
    await network.processAll()

    const res = await network.bsky.getAgent().api.app.bsky.feed.getAuthorFeed({
      actor: op,
    })
    const byUri = new Map(
      res.data.feed.map((item) => [
        item.post.uri,
        item as FeedItemWithOpThreadMetadata,
      ]),
    )

    expect(
      [root, first, second].map(({ ref }) => {
        const item = byUri.get(ref.uriStr)
        return [item?.opThreadPostIndex, item?.opThreadPostCount]
      }),
    ).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })
})
