import { Timestamp } from '@bufbuild/protobuf'
import { Code, ConnectError } from '@connectrpc/connect'
import getPort from 'get-port'
import type { DataplaneClient } from '../src/dataplane.js'
import {
  type BsyncClient,
  BsyncService,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src/index.js'

describe('fanout notification seen', () => {
  let bsync: BsyncService
  let client: BsyncClient
  let firstCalls: unknown[] = []
  let secondCalls: unknown[] = []
  let firstError: Error | undefined
  let secondError: Error | undefined
  const updateFirst = async (req: unknown) => {
    firstCalls.push(req)
    if (firstError) throw firstError
    return {}
  }
  const updateSecond = async (req: unknown) => {
    secondCalls.push(req)
    if (secondError) throw secondError
    return {}
  }

  beforeAll(async () => {
    const dataplaneClients = [updateFirst, updateSecond].map(
      (updateNotificationSeen) =>
        ({ updateNotificationSeen }) as unknown as DataplaneClient,
    )
    bsync = await BsyncService.create(
      envToCfg({
        port: await getPort(),
        dbUrl: process.env.DB_POSTGRES_URL,
        dbSchema: 'bsync_fanout_notification_seen',
        apiKeys: ['key-1'],
      }),
      { dataplaneClients },
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

  beforeEach(() => {
    firstCalls = []
    secondCalls = []
    firstError = undefined
    secondError = undefined
  })

  it('updates every configured dataplane', async () => {
    const timestamp = Timestamp.fromDate(new Date('2026-09-04T12:00:00Z'))

    await client.fanoutNotificationSeen({
      actorDid: 'did:example:alice',
      timestamp,
    })

    expect(firstCalls).toEqual([{ actorDid: 'did:example:alice', timestamp }])
    expect(secondCalls).toEqual([{ actorDid: 'did:example:alice', timestamp }])
  })

  it('succeeds when one dataplane fails', async () => {
    firstError = new Error('unavailable')

    await expect(
      client.fanoutNotificationSeen({
        actorDid: 'did:example:alice',
        timestamp: Timestamp.now(),
      }),
    ).resolves.toBeDefined()
    expect(secondCalls).toHaveLength(1)
  })

  it('fails when every dataplane fails', async () => {
    firstError = new Error('unavailable')
    secondError = new Error('unavailable')

    await expect(
      client.fanoutNotificationSeen({
        actorDid: 'did:example:alice',
        timestamp: Timestamp.now(),
      }),
    ).rejects.toEqual(
      new ConnectError('all dataplane updates failed', Code.Unavailable),
    )
  })
})
