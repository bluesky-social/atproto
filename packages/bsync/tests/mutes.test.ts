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
import { MuteOperation, MuteOperation_Type } from '../src/proto/bsync_pb'

describe('mutes', () => {
  let bsync: BsyncService
  let client: BsyncClient

  beforeAll(async () => {
    bsync = await BsyncService.create(
      envToCfg({
        port: await getPort(),
        dbUrl: process.env.DB_POSTGRES_URL,
        dbSchema: 'bsync_mutes',
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
    await clearMutes(bsync.ctx.db)
  })

  describe('addMuteOperation', () => {
    it('adds mute operations to add mutes.', async () => {
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:c',
      })
      // dupe has no effect
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:b',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:c',
        subject: 'at://did:example:d/app.bsky.graph.list/rkey1',
      })
      expect(await dumpMuteState(bsync.ctx.db)).toEqual({
        'did:example:a': ['did:example:b', 'did:example:c'],
        'did:example:b': ['did:example:c'],
        'did:example:c': ['at://did:example:d/app.bsky.graph.list/rkey1'],
      })
    })

    it('adds mute operations to remove mutes.', async () => {
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:b',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.REMOVE,
        actorDid: 'did:example:a',
        subject: 'did:example:c',
      })
      // removes nothing
      await client.addMuteOperation({
        type: MuteOperation_Type.REMOVE,
        actorDid: 'did:example:b',
        subject: 'did:example:d',
      })
      expect(await dumpMuteState(bsync.ctx.db)).toEqual({
        'did:example:a': ['did:example:b'],
        'did:example:b': ['did:example:c'],
      })
    })

    it('adds mute operations to clear mutes.', async () => {
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:b',
        subject: 'did:example:c',
      })
      await client.addMuteOperation({
        type: MuteOperation_Type.CLEAR,
        actorDid: 'did:example:a',
      })
      expect(await dumpMuteState(bsync.ctx.db)).toEqual({
        'did:example:b': ['did:example:c'],
      })
    })

    it('fails on bad inputs', async () => {
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.ADD,
          actorDid: 'did:example:a',
          subject: 'invalid',
        }),
      ).rejects.toEqual(
        new ConnectError(
          'subject must be a did or aturi on add or remove op',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.ADD,
          actorDid: 'did:example:a',
        }),
      ).rejects.toEqual(
        new ConnectError(
          'subject must be a did or aturi on add or remove op',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.ADD,
          actorDid: 'did:example:a',
          subject: 'at://did:example:b/bad.collection/rkey1',
        }),
      ).rejects.toEqual(
        new ConnectError(
          'subject must be a did or aturi on add or remove op',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.ADD,
          actorDid: 'invalid',
          subject: 'did:example:b',
        }),
      ).rejects.toEqual(
        new ConnectError('actor_did must be a valid did', Code.InvalidArgument),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.REMOVE,
          actorDid: 'did:example:a',
          subject: 'invalid',
        }),
      ).rejects.toEqual(
        new ConnectError(
          'subject must be a did or aturi on add or remove op',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.CLEAR,
          actorDid: 'did:example:a',
          subject: 'did:example:b',
        }),
      ).rejects.toEqual(
        new ConnectError(
          'subject must not be set on a clear op',
          Code.InvalidArgument,
        ),
      )
      await expect(
        client.addMuteOperation({
          type: MuteOperation_Type.CLEAR,
          actorDid: 'invalid',
        }),
      ).rejects.toEqual(
        new ConnectError('actor_did must be a valid did', Code.InvalidArgument),
      )
      await expect(
        client.addMuteOperation({
          type: 100 as any,
          actorDid: 'did:example:a',
          subject: 'did:example:b',
        }),
      ).rejects.toEqual(
        new ConnectError('bad mute operation type', Code.InvalidArgument),
      )
    })

    it('requires auth', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryAddMuteOperation1 = unauthedClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      await expect(tryAddMuteOperation1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryAddMuteOperation2 = badauthedClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      await expect(tryAddMuteOperation2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })
  })

  describe('scanMuteOperations', () => {
    it('requires auth', async () => {
      // unauthed
      const unauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
      })
      const tryScanMuteOperations1 = unauthedClient.scanMuteOperations({})
      await expect(tryScanMuteOperations1).rejects.toEqual(
        new ConnectError('missing auth', Code.Unauthenticated),
      )
      // bad auth
      const badauthedClient = createClient({
        httpVersion: '1.1',
        baseUrl: `http://localhost:${bsync.ctx.cfg.service.port}`,
        interceptors: [authWithApiKey('key-bad')],
      })
      const tryScanMuteOperations2 = badauthedClient.scanMuteOperations({})
      await expect(tryScanMuteOperations2).rejects.toEqual(
        new ConnectError('invalid api key', Code.Unauthenticated),
      )
    })

    it('pages over created mute ops.', async () => {
      // add 100 mute ops
      for (let i = 0; i < 10; ++i) {
        for (let j = 0; j < 8; ++j) {
          await client.addMuteOperation({
            type: MuteOperation_Type.ADD,
            actorDid: `did:example:${i}`,
            subject: `did:example:${j}`,
          })
        }
        for (let j = 0; j < 2; ++j) {
          await client.addMuteOperation({
            type: MuteOperation_Type.ADD,
            actorDid: `did:example:${i}`,
            subject: `at://did:example:0/app.bsky.graph.list/rkey${j}`,
          })
        }
      }

      let cursor: string | undefined
      const operations: MuteOperation[] = []
      do {
        const res = await client.scanMuteOperations({
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
      const scanPromise = client.scanMuteOperations({})
      await wait(100) // would be complete by now if it wasn't long-polling for an item
      const { operation } = await client.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      })
      const res = await scanPromise
      expect(res.operations.length).toEqual(1)
      expect(res.operations[0]).toEqual(operation)
      expect(res.cursor).toEqual(operation?.id)
    })

    it('supports long-poll, not finding an operation.', async () => {
      const res = await client.scanMuteOperations({})
      expect(res.cursor).toEqual('')
      expect(res.operations).toEqual([])
    })
  })
})

const dumpMuteState = async (db: Database) => {
  const items = await db.db.selectFrom('mute_item').selectAll().execute()
  const result: Record<string, string[]> = {}
  items.forEach((item) => {
    result[item.actorDid] ??= []
    result[item.actorDid].push(item.subject)
  })
  Object.values(result).forEach((subjects) => subjects.sort())
  return result
}

const clearMutes = async (db: Database) => {
  await db.db.deleteFrom('mute_item').execute()
  await db.db.deleteFrom('mute_op').execute()
}
