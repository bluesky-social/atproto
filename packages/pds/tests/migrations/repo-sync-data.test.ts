import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { Database } from '../../src'
import { cidForData, TID } from '@atproto/common'
import * as lex from '../../src/lexicon/lexicons'
import { APP_BSKY_GRAPH } from '../../src/lexicon'
import SqlMessageQueue from '../../src/event-stream/message-queue'
import { RecordService } from '../../src/services/record'
import { MessageQueue } from '../../src/event-stream/types'
import { CloseFn, runTestServer } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('repo sync data migration', () => {
  let close: CloseFn
  let db: Database
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'migration_repo_sync_data',
      migration: '_20221215T220356370Z',
    })
    close = server.close
    const client = AtpApi.service(server.url)
    db = server.ctx.db
    sc = new SeedClient(client)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('migrates', async () => {
    await db.migrator.migrateTo('_20221221T013010374Z')
  })

  it('works', async () => {
    const dids = Object.values(sc.dids)
  })
})
