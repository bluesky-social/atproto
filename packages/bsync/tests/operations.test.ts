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
import { Method, Operation } from '../src/proto/bsync_pb'

describe('operations', () => {
  let bsync: BsyncService
  let client: BsyncClient

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
    it('requires auth.', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryPutOperation1 = unauthedClient.putOperation({
        collection: 'app.bsky.some.col',
        actorDid: 'did:example:a',
        rkey: 'rkey1',
        method: Method.CREATE,
        payload: Buffer.from([1, 2, 3]),
      })
      await expect(tryPutOperation1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryPutOperation2 = badauthedClient.putOperation({
        collection: 'app.bsky.some.col',
        actorDid: 'did:example:a',
        rkey: 'rkey1',
        method: Method.CREATE,
        payload: Buffer.from([1, 2, 3]),
      })
      await expect(tryPutOperation2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })

    it('fails on bad inputs.', async () => {
      await expect(
        client.putOperation({
          collection: 'bad-collection',
          actorDid: 'did:example:a',
          rkey: 'rkey1',
          method: Method.CREATE,
          payload: Buffer.from([]),
        }),
      ).rejects.toEqual(
        new ConnectError(
          'operation collection is invalid NSID',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.putOperation({
          collection: 'app.bsky.some.col',
          actorDid: 'bad-did',
          rkey: 'rkey1',
          method: Method.CREATE,
          payload: Buffer.from([]),
        }),
      ).rejects.toEqual(
        new ConnectError(
          'operation actor_did is invalid DID',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.putOperation({
          collection: 'app.bsky.some.col',
          actorDid: 'did:example:a',
          rkey: '',
          method: Method.CREATE,
          payload: Buffer.from([]),
        }),
      ).rejects.toEqual(
        new ConnectError('operation rkey is required', Code.InvalidArgument),
      )
      await expect(
        client.putOperation({
          collection: 'app.bsky.some.col',
          actorDid: 'did:example:a',
          rkey: 'rkey1',
          method: Method.UNSPECIFIED,
          payload: Buffer.from([]),
        }),
      ).rejects.toEqual(
        new ConnectError('operation method is invalid', Code.InvalidArgument),
      )
      await expect(
        client.putOperation({
          collection: 'app.bsky.some.col',
          actorDid: 'did:example:a',
          rkey: 'rkey1',
          method: Method.DELETE,
          payload: Buffer.from([1, 2, 3]),
        }),
      ).rejects.toEqual(
        new ConnectError(
          'cannot specify a payload when method is DELETE',
          Code.InvalidArgument,
        ),
      )
    })

    it('puts operations.', async () => {
      const res = await client.putOperation({
        collection: 'app.bsky.some.col',
        actorDid: 'did:example:a',
        rkey: 'rkey1',
        method: Method.CREATE,
        payload: Buffer.from([1, 2, 3]),
      })

      expect(res.operation?.id).toBe('1')
      expect(await dumpOps(bsync.ctx.db)).toStrictEqual([
        {
          id: 1,
          collection: 'app.bsky.some.col',
          actorDid: 'did:example:a',
          rkey: 'rkey1',
          method: Method.CREATE,
          payload: Buffer.from([1, 2, 3]),
          createdAt: expect.any(Date),
        },
      ])
    })
  })

  describe('scanOperations', () => {
    it('requires auth.', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryScanOperations1 = unauthedClient.scanOperations({})
      await expect(tryScanOperations1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryScanOperations2 = badauthedClient.scanOperations({})
      await expect(tryScanOperations2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })

    it('pages over created ops.', async () => {
      // add 100 ops
      for (let i = 0; i < 100; ++i) {
        await client.putOperation({
          collection: 'app.bsky.some.col',
          actorDid: `did:example:${i}`,
          rkey: 'rkey1',
          method: Method.CREATE,
          payload: Buffer.from([1, 2, 3]),
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
        collection: 'app.bsky.some.col',
        actorDid: 'did:example:a',
        rkey: 'rkey1',
        method: Method.CREATE,
        payload: Buffer.from([1, 2, 3]),
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
  return db.db.selectFrom('op').selectAll().orderBy('id', 'asc').execute()
}

const clearOps = async (db: Database) => {
  await db.db.deleteFrom('op').execute()
}
