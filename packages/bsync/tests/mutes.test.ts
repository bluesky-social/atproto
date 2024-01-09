import { wait } from '@atproto/common'
import {
  BsyncClient,
  BsyncService,
  authWithApiKey,
  createClient,
  envToCfg,
} from '../src'
import { MuteOperation_Type } from '../src/gen/bsync_pb'

describe('mutes', () => {
  let bsync: BsyncService
  let client: BsyncClient

  beforeAll(async () => {
    bsync = await BsyncService.create(
      envToCfg({
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
    await client.ping({})
  })

  afterAll(async () => {
    await bsync.destroy()
  })

  it('xxx.', async () => {
    await client.scanMuteOperations({})
    const scanPromise = client.scanMuteOperations({})
    await wait(100)
    const add = await client.addMuteOperation({
      actorDid: 'did:example:a',
      subject: 'did:example:b',
      type: MuteOperation_Type.ADD,
    })
    console.log(add.toJson())
    const scan = await scanPromise
    console.log(scan.toJson())
  })
})
