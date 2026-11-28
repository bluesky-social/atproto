import assert from 'node:assert'
import getPort from 'get-port'
import { sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { wait } from '@atproto/common'
import {
  type BsyncClient,
  BsyncService,
  type Database,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src/index.js'
import { Method, type Operation } from '../src/proto/bsync_pb.js'

describe('operations', () => {
  let bsync: BsyncService
  let client: BsyncClient

  const validPayload0 = Buffer.from(JSON.stringify({ value: 0 }))
  const validPayload1 = Buffer.from(JSON.stringify({ value: 1 }))

  beforeAll(async () => {
    bsync = await BsyncService.create(
      envToCfg({
        port: await getPort(),
        dbUrl: process.env.DB_POSTGRES_URL,
        dbSchema: 'bsync_operations',
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
    await clearOps(bsync.ctx.db)
  })

  describe('putOperation', () => {
    it('puts operations.', async () => {
      const res1 = await client.putOperation({
        actorDid: 'did:example:a',
        namespace: 'app.bsky.some.col',
        key: 'key1',
        method: Method.CREATE,
        payload: validPayload0,
      })
      const res2 = await client.putOperation({
        actorDid: 'did:example:a',
        namespace: 'app.bsky.other.col#id',
        key: 'key1',
        method: Method.UPDATE,
        payload: validPayload1,
      })

      expect(res1.operation?.id).toBe('1')
      expect(res2.operation?.id).toBe('2')
      expect(await dumpOps(bsync.ctx.db)).toStrictEqual([
        {
          id: 1,
          actorDid: 'did:example:a',
          namespace: 'app.bsky.some.col',
          key: 'key1',
          method: Method.CREATE,
          payload: validPayload0,
          createdAt: expect.any(Date),
        },
        {
          id: 2,
          actorDid: 'did:example:a',
          namespace: 'app.bsky.other.col#id',
          key: 'key1',
          method: Method.UPDATE,
          payload: validPayload1,
          createdAt: expect.any(Date),
        },
      ])
    })

    it('returns the operations on creation.', async () => {
      const res = await client.putOperation({
        actorDid: 'did:example:a',
        namespace: 'app.bsky.some.col',
        key: 'key1',
        method: Method.CREATE,
        payload: validPayload0,
      })

      const op = res.operation
      assert(op)
      // Compare each field individually to avoid custom serialization by proto response objects.
      expect(op.id).toBe('1')
      expect(op.actorDid).toBe('did:example:a')
      expect(op.namespace).toBe('app.bsky.some.col')
      expect(op.key).toBe('key1')
      expect(op.method).toBe(Method.CREATE)
      expect(op.payload).toEqual(new Uint8Array(validPayload0))
      expect(op.createdAt?.toDate()).toEqual(expect.any(Date))
    })
  })

  describe('scanOperations', () => {
    it('pages over created ops.', async () => {
      // add 100 ops
      for (let i = 0; i < 100; ++i) {
        await client.putOperation({
          actorDid: `did:example:${i}`,
          namespace: 'app.bsky.some.col',
          key: 'key1',
          method: Method.CREATE,
          payload: validPayload0,
        })
      }

      let cursor: string | undefined
      const operations: Operation[] = []
      do {
        const res = await client.scanOperations({
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
      const scanPromise = client.scanOperations({})
      await wait(100) // would be complete by now if it wasn't long-polling for an item
      const { operation } = await client.putOperation({
        actorDid: 'did:example:a',
        namespace: 'app.bsky.some.col',
        key: 'key1',
        method: Method.CREATE,
        payload: validPayload0,
      })
      const res = await scanPromise
      expect(res.operations.length).toEqual(1)
      expect(res.operations[0]).toEqual(operation)
      expect(res.cursor).toEqual(operation?.id)
    })

    it('supports long-poll, not finding an operation.', async () => {
      const res = await client.scanOperations({})
      expect(res.cursor).toEqual('')
      expect(res.operations).toEqual([])
    })
  })
})

const dumpOps = async (db: Database) => {
  return db.db
    .selectFrom('operation')
    .selectAll()
    .orderBy('id', 'asc')
    .execute()
}

// @NOTE Restarts the id sequence too: the tests assert on ids, and the schema
// outlives the run.
const clearOps = async (db: Database) => {
  await sql`truncate table operation restart identity`.execute(db.db)
}
