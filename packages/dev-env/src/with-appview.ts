import assert from 'assert'
import getPort from 'get-port'
import { wait } from '@atproto/common-web'
import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { TestBsky } from './bsky'
import { mockNetworkUtilities } from './util'
import { TestNetwork } from './network'

export class TestNetworkWithAppView extends TestNetwork {
  constructor(public plc: TestPlc, public pds: TestPds, public bsky: TestBsky) {
    super(plc, pds)
  }

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetworkWithAppView> {
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl, 'Missing postgres url for tests')
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

    const plc = await TestPlc.create({})
    const bskyPort = await getPort()
    const pds = await TestPds.create({
      dbPostgresUrl,
      dbPostgresSchema,
      plcUrl: plc.url,
      bskyAppViewEndpoint: `http://localhost:${bskyPort}`,
    })
    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      repoProvider: `ws://localhost:${pds.port}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPostgresUrl,
    })
    mockNetworkUtilities(pds)

    return new TestNetworkWithAppView(plc, pds, bsky)
  }

  async processAll(timeout = 5000) {
    if (!this.bsky) return
    const sub = this.bsky.server.sub
    if (!sub) return
    const { db } = this.pds.ctx.db
    const start = Date.now()
    while (Date.now() - start < timeout) {
      await wait(50)
      if (!sub) return
      const state = await sub.getState()
      const { lastSeq } = await db
        .selectFrom('repo_seq')
        .select(db.fn.max('repo_seq.seq').as('lastSeq'))
        .executeTakeFirstOrThrow()
      if (state.cursor === lastSeq) return
    }
    throw new Error(`Sequence was not processed within ${timeout}ms`)
  }

  async close() {
    await this.bsky?.close()
    await this.pds.close()
    await this.plc.close()
  }
}
