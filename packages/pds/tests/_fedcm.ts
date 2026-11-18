import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CDPSession, Page } from 'puppeteer'
import { PageHelper } from './_puppeteer.js'

export type FedcmDialog = {
  dialogId: string
  dialogType: string
  accounts: { accountId: string; idpConfigUrl: string }[]
}

// @NOTE Puppeteer's pinned Chrome predates username-only and multi-IdP support.
export const browserDescribe = process.env.PUPPETEER_EXECUTABLE_PATH
  ? describe
  : describe.skip

/** Chrome args that serve the given hosts from the local TLS server. */
export function fedcmBrowserArgs(tlsPort: number, hosts: string[]): string[] {
  return [
    '--ignore-certificate-errors',
    '--no-proxy-server',
    `--host-resolver-rules=${hosts.map((h) => `MAP ${h} 127.0.0.1:${tlsPort}`).join(', ')}`,
    '--test-third-party-cookie-phaseout',
  ]
}

/** A throwaway self-signed TLS key pair. */
export async function createTlsCredentials(
  commonName: string,
): Promise<{ key: Buffer; cert: Buffer }> {
  const directory = await mkdtemp(join(tmpdir(), 'atproto-fedcm-tls-'))
  try {
    const keyPath = join(directory, 'key.pem')
    const certPath = join(directory, 'cert.pem')
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        `/CN=${commonName}`,
        '-keyout',
        keyPath,
        '-out',
        certPath,
      ],
      { stdio: 'ignore' },
    )
    return { key: await readFile(keyPath), cert: await readFile(certPath) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function closeServers(
  servers: (Server | undefined)[],
): Promise<void> {
  await Promise.all(
    servers
      .filter((server) => server !== undefined)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve())),
          ),
      ),
  )
}

export class FedcmPage extends PageHelper {
  constructor(public override readonly page: Page) {
    super(page)
  }

  async cdp(): Promise<CDPSession> {
    const cdp = await this.page.createCDPSession()
    await cdp.send('FedCm.enable', { disableRejectionDelay: true })
    return cdp
  }

  async api(path: string, input: object) {
    return this.page.evaluate(
      async (path, input) => {
        const csrf = document.cookie
          .split('; ')
          .find((c) => c.startsWith('csrf-token='))
          ?.slice(11)
        const response = await fetch(`/@atproto/oauth-provider/~api${path}`, {
          method: 'POST',
          mode: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf ?? '',
          },
          body: JSON.stringify(input),
        })
        return {
          status: response.status,
          loginStatus: response.headers.get('Set-Login'),
          body: await response.json(),
        }
      },
      path,
      input,
    )
  }
}

export function nextDialog(cdp: CDPSession): Promise<FedcmDialog> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cdp.off('FedCm.dialogShown', onDialog)
      reject(new Error('Timed out waiting for FedCM dialog'))
    }, 10_000)
    function onDialog(dialog: FedcmDialog) {
      clearTimeout(timeout)
      resolve(dialog)
    }
    cdp.once('FedCm.dialogShown', onDialog)
  })
}
