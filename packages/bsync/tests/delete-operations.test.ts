import getPort from 'get-port'
import {
  BsyncClient,
  BsyncService,
  Database,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src'
import { Method } from '../src/proto/bsync_pb'

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
        dbSchema: 'bsync_delete_operations',
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

  it('deletes', async () => {
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

    await client.deleteOperationsByActorAndNamespace({
      actorDid: 'did:example:a',
      namespace: 'app.bsky.some.col',
    })
    await client.deleteOperationsByActorAndNamespace({
      actorDid: 'did:example:a',
      namespace: 'app.bsky.other.col#id',
    })

    expect(await dumpOps(bsync.ctx.db)).toStrictEqual([])
  })
})

const dumpOps = async (db: Database) => {
  return db.db
    .selectFrom('operation')
    .selectAll()
    .orderBy('id', 'asc')
    .execute()
}

const clearOps = async (db: Database) => {
  await db.db.deleteFrom('operation').execute()
}
