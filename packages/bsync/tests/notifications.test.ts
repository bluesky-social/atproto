import { Code, ConnectError } from '@connectrpc/connect'
import getPort from 'get-port'
import { wait } from '@atproto/common'
import {
  BsyncClient,
  BsyncService,
  Database,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src'
import { NotifOperation } from '../src/proto/bsync_pb'

describe('notifications', () => {
  let bsync: BsyncService
  let client: BsyncClient

  beforeAll(async () => {
    bsync = await BsyncService.create(
      envToCfg({
        port: await getPort(),
        dbUrl: process.env.DB_POSTGRES_URL,
        dbSchema: 'bsync_notifications',
        apiKeys: ['key-1'],
        longPollTimeoutMs: 500,
      }),
    )
    await bsync.ctx.db.migrateToLatestOrThrow()
    await bsync.start()
    client = createClient({
      httpVersion: '1.1',
      baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      interceptors: [authWithApiKey('key-1')],
    })
  })

  afterAll(async () => {
    await bsync.destroy()
  })

  beforeEach(async () => {
    await clearNotifs(bsync.ctx.db)
  })

  describe('addNotifOperation', () => {
    it('adds notif operations to set priority.', async () => {
      // true + true
      await client.addNotifOperation({
        actorDid: 'did:example:a',
        priority: true,
      })
      await client.addNotifOperation({
        actorDid: 'did:example:a',
        priority: true,
      })
      // true + none
      await client.addNotifOperation({
        actorDid: 'did:example:b',
        priority: true,
      })
      await client.addNotifOperation({
        actorDid: 'did:example:b',
      })
      // true + false
      await client.addNotifOperation({
        actorDid: 'did:example:c',
        priority: true,
      })
      await client.addNotifOperation({
        actorDid: 'did:example:c',
        priority: false,
      })
      // false + true
      await client.addNotifOperation({
        actorDid: 'did:example:d',
        priority: false,
      })
      await client.addNotifOperation({
        actorDid: 'did:example:d',
        priority: true,
      })
      expect(await dumpNotifState(bsync.ctx.db)).toEqual({
        'did:example:a': true,
        'did:example:b': true,
        'did:example:c': false,
        'did:example:d': true,
      })
    })

    it('fails on bad inputs', async () => {
      await expect(
        client.addNotifOperation({
          actorDid: 'invalid',
          priority: true,
        }),
      ).rejects.toEqual(
        new ConnectError('actor_did must be a valid did', Code.InvalidArgument),
      )
    })

    it('requires auth', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryAddNotifOperation1 = unauthedClient.addNotifOperation({
        actorDid: 'did:example:a',
      })
      await expect(tryAddNotifOperation1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryAddNotifOperation2 = badauthedClient.addNotifOperation({
        actorDid: 'did:example:a',
      })
      await expect(tryAddNotifOperation2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })
  })

  describe('scanNotifOperations', () => {
    it('requires auth', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryScanNotifOperations1 = unauthedClient.scanNotifOperations({})
      await expect(tryScanNotifOperations1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryScanNotifOperations2 = badauthedClient.scanNotifOperations({})
      await expect(tryScanNotifOperations2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })

    it('pages over created notif ops.', async () => {
      // add 100 notif ops
      for (let i = 0; i < 100; ++i) {
        await client.addNotifOperation({
          actorDid: `did:example:${i}`,
          priority: i % 2 === 0,
        })
      }

      let cursor: string | undefined
      const operations: NotifOperation[] = []
      do {
        const res = await client.scanNotifOperations({
          cursor,
          limit: 30,
        })
        operations.push(...res.operations)
        cursor = res.operations.length ? res.cursor : undefined
      } while (cursor)

      expect(operations.length).toEqual(100)
      const operationIds = operations.map((op) => parseInt(op.id, 10))
      const ascending = (a: number, b: number) => a - b
      expect(operationIds).toEqual([...operationIds].sort(ascending))
    })

    it('supports long-poll, finding an operation.', async () => {
      const scanPromise = client.scanNotifOperations({})
      await wait(100) // would be complete by now if it wasn't long-polling for an item
      const { operation } = await client.addNotifOperation({
        actorDid: 'did:example:a',
      })
      const res = await scanPromise
      expect(res.operations.length).toEqual(1)
      expect(res.operations[0]).toEqual(operation)
      expect(res.cursor).toEqual(operation?.id)
    })

    it('supports long-poll, not finding an operation.', async () => {
      const res = await client.scanNotifOperations({})
      expect(res.cursor).toEqual('')
      expect(res.operations).toEqual([])
    })
  })
})

const dumpNotifState = async (db: Database) => {
  const items = await db.db.selectFrom('notif_item').selectAll().execute()
  const result: Record<string, boolean> = {}
  items.forEach((item) => {
    result[item.actorDid] = item.priority
  })
  return result
}

const clearNotifs = async (db: Database) => {
  await db.db.deleteFrom('notif_item').execute()
  await db.db.deleteFrom('notif_op').execute()
}
