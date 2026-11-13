import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'

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

  it('returns complete canonical threads only when requested', async () => {
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
    expect(withoutMetadata.opThreads).toEqual([])

    const withMetadata = await network.bsky.ctx.dataplane.getPostRecords({
      uris,
      includeOpThreadMetadata: true,
    })
    expect(
      Object.fromEntries(
        withMetadata.opThreads.map((thread) => [thread.rootUri, thread.uris]),
      ),
    ).toEqual({
      [root.ref.uriStr]: [root.ref.uriStr, first.ref.uriStr, second.ref.uriStr],
      [otherRoot.ref.uriStr]: [otherRoot.ref.uriStr, otherReply.ref.uriStr],
    })
  })

  it('resolves threads with more than 1,000 OP reply rows', async () => {
    const op = sc.dids.threadop
    const root = await sc.post(op, 'large root')
    const first = await sc.reply(op, root.ref, root.ref, 'first')
    await network.processAll()

    const rootUri = root.ref.uriStr
    const uris = [rootUri, first.ref.uriStr]
    const detachedParent = `${rootUri}-detached`
    await network.bsky.db.db
      .insertInto('op_thread_reply')
      .values(
        Array.from({ length: 1000 }, (_, i) => ({
          rootUri,
          uri: `${rootUri}-filler-${i}`,
          parentUri: detachedParent,
          deletedAt: null,
        })),
      )
      .execute()

    const getOpThreads = async () => {
      const res = await network.bsky.ctx.dataplane.getPostRecords({
        uris,
        includeOpThreadMetadata: true,
      })
      return res.opThreads.map((thread) => thread.uris)
    }
    const getOpThread = async () => {
      const res = await network.bsky.ctx.dataplane.getThread({
        postUri: rootUri,
        above: 0,
        below: 0,
      })
      return res.opThread
    }

    expect(await getOpThreads()).toEqual([[rootUri, first.ref.uriStr]])
    expect(await getOpThread()).toEqual([rootUri, first.ref.uriStr])
  })
})
