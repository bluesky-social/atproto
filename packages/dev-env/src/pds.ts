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
      primaryColor: '#f0828d',
      primaryColorContrast: '#fff', // Bad contrast for a11y (WCAG AA)
      errorColor: 'rgb(238, 0, 78)', // rgb() notation should work too
      logoUrl:
        // Using a "data:" instead of a real URL to avoid making CORS requests in dev.
        // License: https://uxwing.com/license/
        // Source: https://uxwing.com/bee-icon/
        `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 503 511.623"><path fill="#FFB9B9" d="M379.75 85.311l90.022 89.879C503.264 128.804 502.534 31.13 476.188 0c-27.441 31.966-59.103 60.767-96.438 85.311z"/><path fill="#E2828D" d="M399.445 104.976l70.327 70.214c26.443-36.622 31.549-105.205 19.563-147.778-26.692 28.309-56.413 54.344-89.89 77.564z"/><path fill="#FFB9B9" d="M119.595 85.311L29.573 175.19C-3.919 128.804-3.189 31.13 23.156 0c27.441 31.966 59.103 60.767 96.439 85.311z"/><path fill="#E2828D" d="M99.899 104.976L29.573 175.19C3.13 138.568-1.976 69.985 10.01 27.412c26.692 28.309 56.413 54.344 89.889 77.564z"/><path fill="#FFB9B9" d="M251.5 51.303c138.898 0 251.5 103.046 251.5 230.16 0 127.114-112.602 230.16-251.5 230.16C112.6 511.623 0 408.577 0 281.463c0-127.114 112.6-230.16 251.5-230.16z"/><path fill="#331400" d="M138.142 188.245c16.387 0 29.672 13.283 29.672 29.672 0 16.389-13.285 29.673-29.672 29.673-16.389 0-29.675-13.284-29.675-29.673 0-16.389 13.286-29.672 29.675-29.672zM360.695 188.245c16.389 0 29.674 13.283 29.674 29.672 0 16.389-13.285 29.673-29.674 29.673-16.387 0-29.673-13.284-29.673-29.673 0-16.389 13.286-29.672 29.673-29.672z"/><path fill="#F0828D" fill-rule="nonzero" d="M251.5 255.548c37.407 0 71.438 11.136 96.213 29.138 25.886 18.808 41.905 45.125 41.905 74.487 0 29.36-16.017 55.679-41.908 74.49-24.772 18.001-58.805 29.138-96.21 29.138-37.405 0-71.438-11.137-96.21-29.138-25.891-18.811-41.908-45.13-41.908-74.49 0-29.362 16.019-55.679 41.905-74.487 24.775-18.002 58.808-29.138 96.213-29.138z"/><circle fill="#A5414B" cx="203.259" cy="358.515" r="29.673"/><circle fill="#A5414B" cx="298.744" cy="358.515" r="29.673"/></svg>', 'utf8').toString('base64')}`,
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
