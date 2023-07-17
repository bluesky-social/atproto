import assert from 'assert'
import * as uint8arrays from 'uint8arrays'
import getPort from 'get-port'
import { wait } from '@atproto/common-web'
import { createServiceJwt } from '@atproto/xrpc-server'
import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { TestBsky } from './bsky'
import { mockNetworkUtilities } from './util'
import { TestNetworkNoAppView } from './network-no-appview'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin-pass'

export class TestNetwork extends TestNetworkNoAppView {
  constructor(public plc: TestPlc, public pds: TestPds, public bsky: TestBsky) {
    super(plc, pds)
  }

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetwork> {
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl, 'Missing postgres url for tests')
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

    const plc = await TestPlc.create(params.plc ?? {})

    const bskyPort = params.bsky?.port ?? (await getPort())
    const pdsPort = params.pds?.port ?? (await getPort())
    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      repoProvider: `ws://localhost:${pdsPort}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPostgresUrl,
      ...params.bsky,
    })
    const pds = await TestPds.create({
      port: pdsPort,
      dbPostgresUrl,
      dbPostgresSchema,
      plcUrl: plc.url,
      bskyAppViewEndpoint: bsky.url,
      bskyAppViewDid: bsky.ctx.cfg.serverDid,
      ...params.pds,
    })

    mockNetworkUtilities(pds, bsky)

    return new TestNetwork(plc, pds, bsky)
  }

  async processFullSubscription(timeout = 5000) {
    const sub = this.bsky.sub
    if (!sub) return
    const { db } = this.pds.ctx.db
    const start = Date.now()
    while (Date.now() - start < timeout) {
      await wait(50)
      if (!sub) return
      const state = await sub.getState()
      if (!this.pds.ctx.sequencerLeader) {
        throw new Error('Sequencer leader not configured on the pds')
      }
      const caughtUp = await this.pds.ctx.sequencerLeader.isCaughtUp()
      if (!caughtUp) continue
      const { lastSeq } = await db
        .selectFrom('repo_seq')
        .where('seq', 'is not', null)
        .select(db.fn.max('repo_seq.seq').as('lastSeq'))
        .executeTakeFirstOrThrow()
      if (state.cursor === lastSeq) return
    }
    throw new Error(`Sequence was not processed within ${timeout}ms`)
  }

  async processAll(timeout?: number) {
    await this.pds.processAll()
    await this.processFullSubscription(timeout)
    await this.bsky.processAll()
  }

  async serviceHeaders(did: string, aud?: string) {
    const jwt = await createServiceJwt({
      iss: did,
      aud: aud ?? this.bsky.ctx.cfg.serverDid,
      keypair: this.pds.ctx.repoSigningKey,
    })
    return { authorization: `Bearer ${jwt}` }
  }

  async adminHeaders({
    username = ADMIN_USERNAME,
    password = ADMIN_PASSWORD,
  }: {
    username?: string
    password?: string
  }) {
    return {
      authorization:
        'Basic ' +
        uint8arrays.toString(
          uint8arrays.fromString(`${username}:${password}`, 'utf8'),
          'base64pad',
        ),
    }
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    await this.bsky.close()
    await this.pds.close()
    await this.plc.close()
  }
}
