import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as bsky from '@atproto/bsky'
import { DAY, HOUR } from '@atproto/common-web'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { Client as PlcClient } from '@did-plc/lib'
import { BskyConfig } from './types'
import { ADMIN_PASSWORD, MOD_PASSWORD, TRIAGE_PASSWORD } from './const'
import { BackgroundQueue } from '@atproto/bsky/src/data-plane/server/background'

export class TestBsky {
  constructor(
    public url: string,
    public port: number,
    public db: bsky.Database,
    public server: bsky.BskyAppView,
    public dataplane: bsky.DataPlaneServer,
    public bsync: bsky.MockBsync,
    public sub: bsky.RepoSubscription,
  ) {}

  static async create(cfg: BskyConfig): Promise<TestBsky> {
    const serviceKeypair = await Secp256k1Keypair.create()
    const plcClient = new PlcClient(cfg.plcUrl)

    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`
    const serverDid = await plcClient.createDid({
      signingKey: serviceKeypair.did(),
      rotationKeys: [serviceKeypair.did()],
      handle: 'bsky.test',
      pds: `http://localhost:${port}`,
      signer: serviceKeypair,
    })

    // shared across server, ingester, and indexer in order to share pool, avoid too many pg connections.
    const db = new bsky.Database({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
      poolSize: 10,
    })

    const dataplanePort = await getPort()
    const dataplane = await bsky.DataPlaneServer.create(db, dataplanePort)

    const bsyncPort = await getPort()
    const bsync = await bsky.MockBsync.create(db, bsyncPort)

    const config = new bsky.ServerConfig({
      version: 'unknown',
      port,
      didPlcUrl: cfg.plcUrl,
      publicUrl: 'https://bsky.public.url',
      serverDid,
      dataplaneUrls: [`http://localhost:${dataplanePort}`],
      dataplaneHttpVersion: '1.1',
      bsyncUrl: `http://localhost:${bsyncPort}`,
      bsyncHttpVersion: '1.1',
      courierUrl: 'https://fake.example',
      modServiceDid: cfg.modServiceDid ?? 'did:example:invalidMod',
      labelsFromIssuerDids: ['did:example:labeler'], // this did is also used as the labeler in seeds
      ...cfg,
      adminPassword: ADMIN_PASSWORD,
      moderatorPassword: MOD_PASSWORD,
      triagePassword: TRIAGE_PASSWORD,
      feedGenDid: 'did:example:feedGen',
    })

    // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb = new bsky.Database({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
    })
    if (cfg.migration) {
      await migrationDb.migrateToOrThrow(cfg.migration)
    } else {
      await migrationDb.migrateToLatestOrThrow()
    }
    await migrationDb.close()

    const didCache = new bsky.DidSqlCache(db, HOUR, DAY)

    // api server
    const server = bsky.BskyAppView.create({
      config,
      didCache,
      signingKey: serviceKeypair,
      algos: cfg.algos,
    })

    const sub = new bsky.RepoSubscription({
      service: cfg.repoProvider,
      db,
      idResolver: server.ctx.idResolver,
      background: new BackgroundQueue(db),
    })

    await server.start()
    sub.run()

    return new TestBsky(url, port, db, server, dataplane, bsync, sub)
  }

  get ctx(): bsky.AppContext {
    return this.server.ctx
  }

  getClient() {
    return new AtpAgent({ service: this.url })
  }

  adminAuth(role: 'admin' | 'moderator' | 'triage' = 'admin'): string {
    const password =
      role === 'triage'
        ? this.ctx.cfg.triagePassword
        : role === 'moderator'
        ? this.ctx.cfg.moderatorPassword
        : this.ctx.cfg.adminPassword
    return (
      'Basic ' +
      ui8.toString(ui8.fromString(`admin:${password}`, 'utf8'), 'base64pad')
    )
  }

  adminAuthHeaders(role?: 'admin' | 'moderator' | 'triage') {
    return {
      authorization: this.adminAuth(role),
    }
  }

  async close() {
    await this.server.destroy()
    await this.bsync.destroy()
    await this.dataplane.destroy()
    await this.sub.destroy()
    await this.db.close()
  }
}
