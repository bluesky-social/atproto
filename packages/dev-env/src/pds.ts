import path from 'node:path'
import os from 'node:os'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as pds from '@atproto/pds'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { AtpAgent } from '@atproto/api'
import { PdsConfig } from './types'
import { uniqueLockId } from './util'

const ADMIN_PASSWORD = 'admin-pass'

export class TestPds {
  constructor(
    public url: string,
    public port: number,
    public server: pds.PDS,
  ) {}

  static async create(cfg: PdsConfig): Promise<TestPds> {
    const repoSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const repoSigningPriv = ui8.toString(await repoSigningKey.export(), 'hex')
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = ui8.toString(await plcRotationKey.export(), 'hex')
    const recoveryKey = (await Secp256k1Keypair.create()).did()

    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`

    const blobstoreLoc = path.join(os.tmpdir(), randomStr(8, 'base32'))

    const env = pds.envToCfg({
      port,
      blobstoreDiskLocation: blobstoreLoc,
      recoveryDidKey: recoveryKey,
      adminPassword: ADMIN_PASSWORD,
      didPlcUrl: cfg.plcUrl,
      jwtSecret: 'jwt-secret',
      handleDomains: ['.test'],
      sequencerLeaderLockId: uniqueLockId(),
      repoSigningKeyK256PrivateKeyHex: repoSigningPriv,
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
      ...cfg,
    })

    const server = await pds.PDS.create(
      pds.envToCfg(env),
      pds.envToSecrets(env),
    )

    await server.ctx.db.migrateToLatestOrThrow()

    await server.start()
    return new TestPds(url, port, server)
  }

  get ctx(): pds.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    return new AtpAgent({ service: `http://localhost:${this.port}` })
  }

  adminAuth(): string {
    return (
      'Basic ' +
      ui8.toString(
        ui8.fromString(`admin:${ADMIN_PASSWORD}`, 'utf8'),
        'base64pad',
      )
    )
  }

  adminAuthHeaders() {
    return {
      authorization: this.adminAuth(),
    }
  }

  async close() {
    await this.server.destroy()
  }
}
