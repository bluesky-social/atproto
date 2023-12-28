import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as ozone from '@atproto/ozone'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { Client as PlcClient } from '@did-plc/lib'
import { OzoneConfig } from './types'
import { ADMIN_PASSWORD, MOD_PASSWORD, TRIAGE_PASSWORD } from './const'

export class TestOzone {
  constructor(
    public url: string,
    public port: number,
    public server: ozone.OzoneService,
    public daemon: ozone.OzoneDaemon,
  ) {}

  static async create(cfg: OzoneConfig): Promise<TestOzone> {
    const serviceKeypair = cfg.signingKey ?? (await Secp256k1Keypair.create())
    let serverDid = cfg.serverDid
    if (!serverDid) {
      const plcClient = new PlcClient(cfg.plcUrl)
      serverDid = await plcClient.createDid({
        signingKey: serviceKeypair.did(),
        rotationKeys: [serviceKeypair.did()],
        handle: 'ozone.test',
        pds: `https://pds.invalid`,
        signer: serviceKeypair,
      })
    }

    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`
    const config = new ozone.ServerConfig({
      version: '0.0.0',
      port,
      didPlcUrl: cfg.plcUrl,
      publicUrl: 'https://bsky.public.url',
      serverDid,
      ...cfg,
      adminPassword: ADMIN_PASSWORD,
      moderatorPassword: MOD_PASSWORD,
      triagePassword: TRIAGE_PASSWORD,
      labelerDid: 'did:example:labeler',
    })

    // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb = new ozone.Database({
      schema: cfg.dbPostgresSchema,
      url: cfg.dbPostgresUrl,
    })
    if (cfg.migration) {
      await migrationDb.migrateToOrThrow(cfg.migration)
    } else {
      await migrationDb.migrateToLatestOrThrow()
    }
    await migrationDb.close()

    const db = new ozone.Database({
      schema: cfg.dbPostgresSchema,
      url: cfg.dbPostgresUrl,
      poolSize: 10,
    })

    // api server
    const server = ozone.OzoneService.create({
      db,
      config,
      signingKey: serviceKeypair,
    })
    await server.start()

    const daemonDb = new ozone.Database({
      schema: cfg.dbPostgresSchema,
      url: cfg.dbPostgresUrl,
      poolSize: 10,
    })
    const daemonConfig = new ozone.DaemonConfig({
      version: config.version,
      dbPostgresUrl: config.dbPostgresUrl,
      dbPostgresSchema: config.dbPostgresSchema,
      serverDid: config.serverDid,
      appviewUrl: config.appviewUrl,
      appviewDid: config.appviewDid,
      pdsUrl: config.pdsUrl,
      pdsDid: config.pdsDid,
    })
    const daemon = ozone.OzoneDaemon.create({
      db: daemonDb,
      signingKey: serviceKeypair,
      cfg: daemonConfig,
    })
    await daemon.start()
    // don't do event reversal in dev-env
    await daemon.ctx.eventReverser.destroy()

    return new TestOzone(url, port, server, daemon)
  }

  get ctx(): ozone.AppContext {
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

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
    await this.daemon.processAll()
  }

  async close() {
    await this.daemon.destroy()
    await this.server.destroy()
  }
}
