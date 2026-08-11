import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import { OP_THREAD_REPLY_LIMIT } from '../../src/data-plane/server/op-thread.js'

describe('data plane OP thread metadata', () => {
  let network: TestNetwork
  let sc: SeedClient<TestNetwork>

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_op_thread_metadata',
    })
    sc = network.getSeedClient()
    await sc.createAccount('threadop', {
      handle: 'threadop.test',
      email: 'threadop@test.com',
      password: 'threadop-pass',
    })
    await network.processAll()
  })

  afterAll(async () => network?.close())

  it('returns aligned canonical metadata only when requested', async () => {
    const op = sc.dids.threadop
    const root = await sc.post(op, 'root')
    const first = await sc.reply(op, root.ref, root.ref, 'first')
    const fork = await sc.reply(op, root.ref, root.ref, 'fork')
    const second = await sc.reply(op, root.ref, first.ref, 'second')

    const otherRoot = await sc.post(op, 'other root')
    const otherReply = await sc.reply(
      op,
      otherRoot.ref,
      otherRoot.ref,
      'other reply',
    )
    const standalone = await sc.post(op, 'standalone')
    await network.processAll()

    const missing = `at://${op}/app.bsky.feed.post/missing`
    const uris = [
      second.ref.uriStr,
      root.ref.uriStr,
      missing,
      fork.ref.uriStr,
      first.ref.uriStr,
      otherReply.ref.uriStr,
      otherRoot.ref.uriStr,
      standalone.ref.uriStr,
    ]

    const withoutMetadata = await network.bsky.ctx.dataplane.getPostRecords({
      uris,
    })
    expect(
      withoutMetadata.meta.map((item) => [
        item.opThreadPostIndex,
        item.opThreadPostCount,
      ]),
    ).toEqual(uris.map(() => [undefined, undefined]))

    const withMetadata = await network.bsky.ctx.dataplane.getPostRecords({
      uris,
      includeOpThreadMetadata: true,
    })
    expect(
      withMetadata.meta.map((item) => [
        item.opThreadPostIndex,
        item.opThreadPostCount,
      ]),
    ).toEqual([
      [3, 3],
      [1, 3],
      [undefined, undefined],
      [undefined, undefined],
      [2, 3],
      [2, 2],
      [1, 2],
      [undefined, undefined],
    ])
  })

  it('applies the reply-row ceiling consistently', async () => {
    const op = sc.dids.threadop
    const root = await sc.post(op, 'capped root')
    const first = await sc.reply(op, root.ref, root.ref, 'capped first')
    await network.processAll()

    const rootUri = root.ref.uriStr
    const uris = [rootUri, first.ref.uriStr]
    // Off-chain filler: every row replies to the root's sibling branch, so it
    // never joins the canonical chain and only inflates the row count.
    const detachedParent = `${rootUri}-detached`
    const padRoot = async (
      from: number,
      to: number,
      deletedAt: string | null = null,
    ) => {
      await network.bsky.db.db
        .insertInto('op_thread_reply')
        .values(
          Array.from({ length: to - from }, (_, i) => ({
            rootUri,
            uri: `${rootUri}-filler-${from + i}`,
            parentUri: detachedParent,
            deletedAt,
          })),
        )
        .execute()
    }

    const getIndices = async () => {
      const res = await network.bsky.ctx.dataplane.getPostRecords({
        uris,
        includeOpThreadMetadata: true,
      })
      return res.meta.map((item) => [
        item.opThreadPostIndex,
        item.opThreadPostCount,
      ])
    }
    const getOpThread = async () => {
      const res = await network.bsky.ctx.dataplane.getThread({
        postUri: rootUri,
        above: 0,
        below: 0,
      })
      return res.opThread
    }

    // One real reply is already indexed, so pad up to exactly the ceiling.
    await padRoot(0, OP_THREAD_REPLY_LIMIT - 1)
    expect(await getIndices()).toEqual([
      [1, 2],
      [2, 2],
    ])
    expect(await getOpThread()).toEqual([rootUri, first.ref.uriStr])

    // Tombstones count toward the same ceiling as live replies, matching the
    // production dataplane. Both routes omit the canonical thread rather than
    // resolve it from a truncated row set.
    await padRoot(
      OP_THREAD_REPLY_LIMIT - 1,
      OP_THREAD_REPLY_LIMIT,
      new Date().toISOString(),
    )
    expect(await getIndices()).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ])
    expect(await getOpThread()).toEqual([])
  })
})
