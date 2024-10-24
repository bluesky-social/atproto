import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as bsky from '@atproto/bsky'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { Client as PlcClient } from '@did-plc/lib'
import { BskyConfig } from './types'
import { ADMIN_PASSWORD, EXAMPLE_LABELER } from './const'

export * from '@atproto/bsky'

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
    const dataplane = await bsky.DataPlaneServer.create(
      db,
      dataplanePort,
      cfg.plcUrl,
    )

    const bsyncPort = await getPort()
    const bsync = await bsky.MockBsync.create(db, bsyncPort)

    const config = new bsky.ServerConfig({
      version: 'unknown',
      port,
      didPlcUrl: cfg.plcUrl,
      publicUrl: 'https://bsky.public.url',
      serverDid,
      alternateAudienceDids: [],
      dataplaneUrls: [`http://localhost:${dataplanePort}`],
      dataplaneHttpVersion: '1.1',
      bsyncUrl: `http://localhost:${bsyncPort}`,
      bsyncHttpVersion: '1.1',
      modServiceDid: cfg.modServiceDid ?? 'did:example:invalidMod',
      labelsFromIssuerDids: [EXAMPLE_LABELER],
      ...cfg,
      adminPasswords: [ADMIN_PASSWORD],
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

    // api server
    const server = bsky.BskyAppView.create({
      config,
      signingKey: serviceKeypair,
    })

    const sub = new bsky.RepoSubscription({
      service: cfg.repoProvider,
      db,
      idResolver: dataplane.idResolver,
    })

    await server.start()

    sub.start()

    return new TestBsky(url, port, db, server, dataplane, bsync, sub)
  }

  get ctx(): bsky.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    const agent = new AtpAgent({ service: this.url })
    agent.configureLabelers([EXAMPLE_LABELER])
    return agent
  }

  adminAuth(): string {
    const [password] = this.ctx.cfg.adminPasswords
    return (
      'Basic ' +
      ui8.toString(ui8.fromString(`admin:${password}`, 'utf8'), 'base64pad')
    )
  }

  adminAuthHeaders() {
    return {
      authorization: this.adminAuth(),
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
