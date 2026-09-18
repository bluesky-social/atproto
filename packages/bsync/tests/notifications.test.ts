import { Code, ConnectError } from '@connectrpc/connect'
import getPort from 'get-port'
import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { createNotifOpChannel } from '../src/db/schema/notif_op.js'
import {
  type BsyncClient,
  BsyncService,
  type Database,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src/index.js'
import type { NotifOperation } from '../src/proto/bsync_pb.js'

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
      await bsync.ctx.db.db
        .insertInto('notif_op')
        .values(
          Array.from({ length: 100 }, (_, i) => ({
            actorDid: `did:example:${i}`,
            priority: i % 2 === 0,
          })),
        )
        .execute()

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
      const { id } = await bsync.ctx.db.db
        .insertInto('notif_op')
        .values({ actorDid: 'did:example:a' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const { ref } = bsync.ctx.db.db.dynamic
      await sql`notify ${ref(createNotifOpChannel)}`.execute(bsync.ctx.db.db)
      const res = await scanPromise
      expect(res.operations.length).toEqual(1)
      expect(res.operations[0]).toMatchObject({
        id: String(id),
        actorDid: 'did:example:a',
      })
      expect(res.cursor).toEqual(String(id))
    })

    it('supports long-poll, not finding an operation.', async () => {
      const res = await client.scanNotifOperations({})
      expect(res.cursor).toEqual('')
      expect(res.operations).toEqual([])
    })
  })
})

const clearNotifs = async (db: Database) => {
  await db.db.deleteFrom('notif_item').execute()
  await db.db.deleteFrom('notif_op').execute()
}
