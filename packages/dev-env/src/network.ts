import assert from 'assert'
import * as uint8arrays from 'uint8arrays'
import getPort from 'get-port'
import { wait } from '@atproto/common-web'
import { createServiceJwt } from '@atproto/xrpc-server'
import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { TestBsky } from './bsky'
import { TestOzone, createOzoneDid } from './ozone'
import { mockNetworkUtilities } from './util'
import { TestNetworkNoAppView } from './network-no-appview'
import { Secp256k1Keypair } from '@atproto/crypto'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin-pass'

export class TestNetwork extends TestNetworkNoAppView {
  constructor(
    public plc: TestPlc,
    public pds: TestPds,
    public bsky: TestBsky,
    public ozone: TestOzone,
  ) {
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
    const ozonePort = params.ozone?.port ?? (await getPort())

    const ozoneKey = await Secp256k1Keypair.create({ exportable: true })
    const ozoneDid = await createOzoneDid(plc.url, ozoneKey)

    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      pdsPort,
      repoProvider: `ws://localhost:${pdsPort}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPostgresUrl,
      redisHost,
      modServiceDid: ozoneDid,
      labelsFromIssuerDids: [ozoneDid, 'did:example:labeler'], // this did is also used as the labeler in seeds
      ...params.bsky,
    })

    const pds = await TestPds.create({
      port: pdsPort,
      didPlcUrl: plc.url,
      bskyAppViewUrl: bsky.url,
      bskyAppViewDid: bsky.ctx.cfg.serverDid,
      modServiceUrl: `http://localhost:${ozonePort}`,
      modServiceDid: ozoneDid,
      ...params.pds,
    })

    const ozone = await TestOzone.create({
      port: ozonePort,
      plcUrl: plc.url,
      signingKey: ozoneKey,
      serverDid: ozoneDid,
      dbPostgresSchema: `ozone_${dbPostgresSchema}`,
      dbPostgresUrl,
      appviewUrl: bsky.url,
      appviewDid: bsky.ctx.cfg.serverDid,
      appviewPushEvents: true,
      pdsUrl: pds.url,
      pdsDid: pds.ctx.cfg.service.did,
      ...params.ozone,
    })

    mockNetworkUtilities(pds, bsky)

    return new TestNetwork(plc, pds, bsky, ozone)
  }

  async processFullSubscription(timeout = 5000) {
    const sub = this.bsky.sub
    const start = Date.now()
    const lastSeq = await this.pds.ctx.sequencer.curr()
    if (!lastSeq) return
    while (Date.now() - start < timeout) {
      if (sub.seenSeq !== null && sub.seenSeq >= lastSeq) {
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
    await this.bsky.sub.background.processAll()
    await this.ozone.processAll()
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
    await this.ozone.close()
    await this.bsky.close()
    await this.pds.close()
    await this.plc.close()
  }
}
