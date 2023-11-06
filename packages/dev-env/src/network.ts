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
    const redisHost = process.env.REDIS_HOST
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl, 'Missing postgres url for tests')
    assert(redisHost, 'Missing redis host for tests')
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

    const plc = await TestPlc.create(params.plc ?? {})

    const bskyPort = params.bsky?.port ?? (await getPort())
    const pdsPort = params.pds?.port ?? (await getPort())
    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      pdsPort,
      repoProvider: `ws://localhost:${pdsPort}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPrimaryPostgresUrl: dbPostgresUrl,
      redisHost,
      moderationPushUrl: `http://admin:${ADMIN_PASSWORD}@localhost:${pdsPort}`,
      ...params.bsky,
    })
    const pds = await TestPds.create({
      port: pdsPort,
      didPlcUrl: plc.url,
      bskyAppViewUrl: bsky.url,
      bskyAppViewDid: bsky.ctx.cfg.serverDid,
      bskyAppViewModeration: true,
      ...params.pds,
    })

    mockNetworkUtilities(pds, bsky)

    return new TestNetwork(plc, pds, bsky)
  }

  async processFullSubscription(timeout = 5000) {
    const sub = this.bsky.indexer.sub
    const start = Date.now()
    const lastSeq = await this.pds.ctx.sequencer.curr()
    if (!lastSeq) return
    while (Date.now() - start < timeout) {
      const partitionState = sub.partitions.get(0)
      if (partitionState?.cursor >= lastSeq) {
        // has seen last seq, just need to wait for it to finish processing
        await sub.repoQueue.main.onIdle()
        return
      }
      await wait(5)
    }
    throw new Error(`Sequence was not processed within ${timeout}ms`)
  }

  async processAll(timeout?: number) {
    await this.pds.processAll()
    await this.processFullSubscription(timeout)
    await this.bsky.processAll()
  }

  async serviceHeaders(did: string, aud?: string) {
    const keypair = await this.pds.ctx.actorStore.keypair(did)
    const jwt = await createServiceJwt({
      iss: did,
      aud: aud ?? this.bsky.ctx.cfg.serverDid,
      keypair,
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
