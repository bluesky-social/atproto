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
      // @NOTE ".example" will not actually work and is only used to display
      // multiple domains in the sing-up UI
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
      // Purposefully not setting warningColor to ensure that not all branding
      // colors are required from a config perspective.
      warningColor: undefined,
      successColor: '#02c39a',
      logoUrl:
        // Using a "data:" instead of a real URL to avoid making CORS requests in dev.
        // License: https://uxwing.com/license/
        // Source: https://uxwing.com/bee-icon/
        `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 117.47 122.88"><defs><style>.cls-1,.cls-2{fill-rule:evenodd;}.cls-2{fill:#ffcb1e;}</style></defs><title>bee</title><path class="cls-1" d="M72.69,49.18c5.93.81,12.68,1.76,19.09,3.3,41.08,9.87,25.49,44.79,4.33,40.78A23.57,23.57,0,0,1,83.48,86.2c0,1.23-.12,2.45-.24,3.65a1.47,1.47,0,0,1-.07.72,49.21,49.21,0,0,1-6.78,20.68c-4.49,7.15-10.75,11.63-17.72,11.63S45.4,118.52,40.9,111.46a41.91,41.91,0,0,1-4-8.23l-.06-.18a54.7,54.7,0,0,1-3-17.22,24.75,24.75,0,0,1-13,7.43C.68,97.49-15.49,62.44,25.22,52.48A184,184,0,0,1,44.4,49.16l-.09-.09a9.18,9.18,0,0,1-1.9-2.74,28,28,0,0,1-2.26-10.81,17.15,17.15,0,0,1,5.41-12.45,18.57,18.57,0,0,1,7.78-4.42,19.21,19.21,0,0,0-2.19-7.07A8.05,8.05,0,0,0,47.4,8.13a4.77,4.77,0,1,1,1.38-3.36c0,.22,0,.43,0,.64a11,11,0,0,1,5,4.64,21.82,21.82,0,0,1,2.56,8,20.17,20.17,0,0,1,2.21-.13c.56,0,1.11,0,1.65.07a21.65,21.65,0,0,1,2.66-8.14,10.84,10.84,0,0,1,5.45-4.68c0-.14,0-.28,0-.42A4.77,4.77,0,1,1,69.49,8a7.8,7.8,0,0,0-4.07,3.48,18.73,18.73,0,0,0-2.26,7.06,18.57,18.57,0,0,1,8.31,4.56,17.11,17.11,0,0,1,5.41,12.45,27.65,27.65,0,0,1-2.6,11.38,10,10,0,0,1-1.59,2.28Z"/><path class="cls-2" d="M40.15,103.25a37.55,37.55,0,0,0,3.3,6.59c3.94,6.18,9.33,10,15.22,10s11.22-3.94,15.16-10.21A38.55,38.55,0,0,0,77,103.28q-9.49-5.66-18.7-5.66a33.91,33.91,0,0,0-18.17,5.63Zm31-37.85c-.65-1.51-1.29-3-1.92-4.42-1.84-4.19-3.37-7.81-5.18-12a21.24,21.24,0,0,0-5.76-.9,22,22,0,0,0-5.23.54C51.2,53,49.64,56.67,47.74,61l-1.89,4.36a41.7,41.7,0,0,1,12.58-2.09A37.6,37.6,0,0,1,71.17,65.4ZM69.39,25.26A15.7,15.7,0,0,0,58.52,21a15.89,15.89,0,0,0-3,.28,1.21,1.21,0,0,1-.33.07h0a15.56,15.56,0,0,0-7.47,3.93,14.13,14.13,0,0,0-4.46,10.26,24.67,24.67,0,0,0,2,9.51,6.21,6.21,0,0,0,1.24,1.83,1.43,1.43,0,0,0,1,.47,1.51,1.51,0,0,0,.64-.16,24,24,0,0,1,20.6.37,1.55,1.55,0,0,0,.73.2,1.57,1.57,0,0,0,1-.46,6.41,6.41,0,0,0,1.3-1.78,24.28,24.28,0,0,0,2.25-10,14.17,14.17,0,0,0-4.46-10.26Zm9.38,55c-1.86-2.83-4.59-10.46-7.11-11.45a35.4,35.4,0,0,0-13.21-2.54A40,40,0,0,0,45,68.82c-1.8.66-5.3,9.18-6.78,11.44-1.65,2.51-1.33,1.13-1.36,3.52,0,.12,0,.45,0,1s0,1.32,0,2c.29-.28.59-.55.89-.81C43.56,81,51.53,79.15,59.3,79.48S74.62,82.3,79.69,86.1l.73.58c0-.82.06-3.55.06-4.38,0-.39-.85-.74-1.71-2ZM37.19,90.9a50.67,50.67,0,0,0,1.94,9.42A36.54,36.54,0,0,1,58.32,94.6q9.78,0,19.73,5.78a52,52,0,0,0,2.08-9.86,17.62,17.62,0,0,0-2.26-2c-4.6-3.45-11.55-5.72-18.69-6S44.9,83.86,39.76,88.26a19.46,19.46,0,0,0-2.57,2.64Z"/></svg>', 'utf8').toString('base64')}`,
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
