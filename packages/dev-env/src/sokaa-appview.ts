import { Client as PlcClient } from '@did-plc/lib'
import getPort from 'get-port'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import * as sokaa from '@atproto/sokaa-appview'
import { ADMIN_PASSWORD } from './const'
import { SokaaAppViewConfig } from './types'

export class TestSokaaAppView {
  constructor(
    public url: string,
    public port: number,
    public db: sokaa.Database,
    public server: sokaa.SokaaAppView,
    public dataplane: sokaa.DataPlaneServer,
    public sub: sokaa.RepoSubscription,
    public serverDid: string,
  ) {}

  static async create(cfg: SokaaAppViewConfig): Promise<TestSokaaAppView> {
    const serviceKeypair = cfg.privateKey
      ? await Secp256k1Keypair.import(cfg.privateKey)
      : await Secp256k1Keypair.create()
    const plcClient = new PlcClient(cfg.plcUrl)

    const port = cfg.port ?? (await getPort())
    const url = `http://127.0.0.1:${port}`

    const serverDid = await plcClient.createDid({
      signingKey: serviceKeypair.did(),
      rotationKeys: [serviceKeypair.did()],
      handle: 'sokaa.test',
      pds: url,
      signer: serviceKeypair,
    })

    await plcClient.updateData(serverDid, serviceKeypair, (x) => {
      x.services['sokaa_appview'] = {
        type: 'SokaaAppView',
        endpoint: url,
      }
      return x
    })

    const db = new sokaa.Database({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
      poolSize: 10,
    })

    const migrationDb = new sokaa.Database({
      url: cfg.dbPostgresUrl,
      schema: cfg.dbPostgresSchema,
    })
    await migrationDb.migrateToLatestOrThrow()
    await migrationDb.close()

    const dataplanePort = await getPort()
    const dataplane = await sokaa.DataPlaneServer.create(db, dataplanePort)

    const config = new sokaa.ServerConfig({
      port,
      publicUrl: url,
      serverDid,
      alternateAudienceDids: [],
      dataplaneUrl: dataplane.url,
      didPlcUrl: cfg.plcUrl,
      adminPasswords: [ADMIN_PASSWORD],
    })

    const server = sokaa.SokaaAppView.create({ config, db })

    const idResolver = new IdResolver({ plcUrl: cfg.plcUrl })
    const sub = await sokaa.RepoSubscription.create({
      service: cfg.repoProvider,
      db,
      idResolver,
    })

    await server.start()
    if (cfg.startSubscription !== false) {
      sub.start()
    }

    return new TestSokaaAppView(
      url,
      port,
      db,
      server,
      dataplane,
      sub,
      serverDid,
    )
  }

  get ctx(): sokaa.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    return new AtpAgent({ service: this.url })
  }

  async close() {
    await this.sub.destroy()
    await this.server.destroy()
    await this.dataplane.destroy()
    await this.db.close()
  }
}
