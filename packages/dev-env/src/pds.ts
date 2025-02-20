import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import * as pds from '@atproto/pds'
import { createSecretKeyObject } from '@atproto/pds'
import { ADMIN_PASSWORD, EXAMPLE_LABELER, JWT_SECRET } from './const'
import { PdsConfig } from './types'

export class TestPds {
  constructor(
    public url: string,
    public port: number,
    public server: pds.PDS,
  ) {}

  static async create(config: PdsConfig): Promise<TestPds> {
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = ui8.toString(await plcRotationKey.export(), 'hex')
    const recoveryKey = (await Secp256k1Keypair.create()).did()

    const port = config.port || (await getPort())
    const url = `http://localhost:${port}`

    const blobstoreLoc = path.join(os.tmpdir(), randomStr(8, 'base32'))
    const dataDirectory = path.join(os.tmpdir(), randomStr(8, 'base32'))
    await fs.mkdir(dataDirectory, { recursive: true })

    const env: pds.ServerEnvironment = {
      devMode: true,
      port,
      dataDirectory: dataDirectory,
      blobstoreDiskLocation: blobstoreLoc,
      recoveryDidKey: recoveryKey,
      adminPassword: ADMIN_PASSWORD,
      jwtSecret: JWT_SECRET,
      serviceHandleDomains: ['.test', '.example'],
      bskyAppViewUrl: 'https://appview.invalid',
      bskyAppViewDid: 'did:example:invalid',
      bskyAppViewCdnUrlPattern: 'http://cdn.appview.com/%s/%s/%s',
      modServiceUrl: 'https://moderator.invalid',
      modServiceDid: 'did:example:invalid',
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
      inviteRequired: false,
      disableSsrfProtection: true,
      serviceName: 'Development PDS',
      brandColor: '#8338ec',
      errorColor: '#ff006e',
      warningColor: '#fb5607',
      successColor: '#02c39a',
      logoUrl:
        'data:image/png;base64,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',
      homeUrl: 'https://bsky.social/',
      termsOfServiceUrl: 'https://bsky.social/about/support/tos',
      privacyPolicyUrl: 'https://bsky.social/about/support/privacy-policy',
      supportUrl: 'https://blueskyweb.zendesk.com/hc/en-us',
      ...config,
    }
    const cfg = pds.envToCfg(env)
    const secrets = pds.envToSecrets(env)

    const server = await pds.PDS.create(cfg, secrets)

    await server.start()

    return new TestPds(url, port, server)
  }

  get ctx(): pds.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    const agent = new AtpAgent({ service: this.url })
    agent.configureLabelers([EXAMPLE_LABELER])
    return agent
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

  jwtSecretKey() {
    return createSecretKeyObject(JWT_SECRET)
  }

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
  }

  async close() {
    await this.server.destroy()
  }
}
