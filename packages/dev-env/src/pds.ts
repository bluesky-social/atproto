import path from 'node:path'
import os from 'node:os'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as pds from '@atproto/pds'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { AtpAgent } from '@atproto/api'
import { PdsConfig } from './types'
import { uniqueLockId } from './util'
import { ADMIN_PASSWORD, MOD_PASSWORD, TRIAGE_PASSWORD } from './const'

export class TestPds {
  constructor(
    public url: string,
    public port: number,
    public server: pds.PDS,
  ) {}

  static async create(config: PdsConfig): Promise<TestPds> {
    const repoSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const repoSigningPriv = ui8.toString(await repoSigningKey.export(), 'hex')
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = ui8.toString(await plcRotationKey.export(), 'hex')
    const recoveryKey = (await Secp256k1Keypair.create()).did()

    const port = config.port || (await getPort())
    const url = `http://localhost:${port}`

    const blobstoreLoc = path.join(os.tmpdir(), randomStr(8, 'base32'))

    const env: pds.ServerEnvironment = {
      port,
      blobstoreDiskLocation: blobstoreLoc,
      recoveryDidKey: recoveryKey,
      adminPassword: ADMIN_PASSWORD,
      moderatorPassword: MOD_PASSWORD,
      triagePassword: TRIAGE_PASSWORD,
      jwtSecret: 'jwt-secret',
      serviceHandleDomains: ['.test'],
      sequencerLeaderLockId: uniqueLockId(),
      bskyAppViewUrl: 'https://appview.invalid',
      bskyAppViewDid: 'did:example:invalid',
      bskyAppViewCdnUrlPattern: 'http://cdn.appview.com/%s/%s/%s',
      repoSigningKeyK256PrivateKeyHex: repoSigningPriv,
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
      inviteRequired: false,
      ...config,
    }
    const cfg = pds.envToCfg(env)
    const secrets = pds.envToSecrets(env)

    const server = await pds.PDS.create(cfg, secrets)

    // Separate migration db on postgres in case migration changes some
    // connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb =
      cfg.db.dialect === 'pg'
        ? pds.Database.postgres({
            url: cfg.db.url,
            schema: cfg.db.schema,
          })
        : server.ctx.db
    await migrationDb.migrateToLatestOrThrow()
    if (migrationDb !== server.ctx.db) {
      await migrationDb.close()
    }

    await server.start()

    return new TestPds(url, port, server)
  }

  get ctx(): pds.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    return new AtpAgent({ service: `http://localhost:${this.port}` })
  }

  adminAuth(role: 'admin' | 'moderator' | 'triage' = 'admin'): string {
    const password =
      role === 'triage'
        ? TRIAGE_PASSWORD
        : role === 'moderator'
        ? MOD_PASSWORD
        : ADMIN_PASSWORD
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
  }

  async close() {
    await this.server.destroy()
  }
}
