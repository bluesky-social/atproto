import { execFile } from 'node:child_process'
import { X509Certificate, createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { type Server, createServer } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execPath } from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, expect, it, test } from 'vitest'
import intermediates from './fixtures/emudhra-intermediates.json' with { type: 'json' }
import fixture from './fixtures/emudhra-tls.json' with { type: 'json' }

const run = promisify(execFile)
const preload = new URL('../src/emudhra-preload.mjs', import.meta.url)
const cwd = fileURLToPath(new URL('..', import.meta.url))
const servers: Server[] = []
let directory: string
let testPreload: string
let tracing: string
let allowedUrl: string
let blockedUrl: string
let blockedRequests = 0

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'emudhra-preload-'))
  testPreload = join(directory, 'preload.mjs')
  tracing = join(directory, 'tracing.mjs')
  const source = await readFile(preload, 'utf8')
  const spki = new X509Certificate(
    fixture.blocked.intermediate,
  ).publicKey.export({
    type: 'spki',
    format: 'der',
  })
  // @NOTE Exercise real TLS rejection without publishing a configurable blocklist
  // or needing any of the compromised CAs' private keys.
  await writeFile(
    testPreload,
    source.replace(
      intermediates[0].spki_sha256.toLowerCase(),
      createHash('sha256').update(spki).digest('hex'),
    ),
  )
  await writeFile(
    tracing,
    `import { connect } from 'node:tls'
     globalThis.tracingLoaded = true
     globalThis.tracingConnect = connect\n`,
  )
  await writeFile(join(directory, 'root.pem'), fixture.root)
  allowedUrl = await listen(fixture.allowed.cert, false)
  blockedUrl = await listen(fixture.blocked.cert, true)
})

afterAll(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) return resolve()
          server.closeAllConnections()
          server.close((err) => (err ? reject(err) : resolve()))
        }),
    ),
  )
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function listen(cert: string, blocked: boolean): Promise<string> {
  const server = createServer({ cert, key: fixture.key }, async (req, res) => {
    if (blocked) blockedRequests++
    for await (const _chunk of req) {
      // @NOTE Drain the body so the test covers application writes after TLS.
    }
    res.end('ok')
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `https://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function request(
  client: string,
  url: string,
  options: {
    mitigation?: boolean
    trust?: boolean
    preloadViaNodeOptions?: boolean
  } = {},
): Promise<{ body?: string; code?: string; tracing: boolean }> {
  const { stdout } = await run(
    execPath,
    [
      ...(options.mitigation === false || options.preloadViaNodeOptions
        ? []
        : [`--import=${testPreload}`]),
      `--import=${tracing}`,
      '--input-type=module',
      '--eval',
      `
        import { request, Agent } from 'node:https'
        import { readFileSync } from 'node:fs'
        const client = ${JSON.stringify(client)}
        const url = ${JSON.stringify(url)}
        const ca = readFileSync(${JSON.stringify(join(directory, 'root.pem'))})
        const tracing = globalThis.tracingLoaded === true
        try {
          let body
          if (client.startsWith('https')) {
            const agent = new Agent({
              ...(client.includes('custom-ca') ? { ca } : {}),
              ...(client.includes('custom-check') ? { checkServerIdentity() {} } : {}),
              ...(client.includes('bad-hostname') ? { servername: 'wrong.example' } : {}),
            })
            if (client.includes('from-tracing')) {
              agent.createConnection = globalThis.tracingConnect
            }
            try {
              body = await new Promise((resolve, reject) => {
                const req = request(url, { agent, method: 'POST' }, async (res) => {
                  res.setEncoding('utf8')
                  let text = ''
                  for await (const chunk of res) text += chunk
                  resolve(text)
                })
                req.on('error', reject)
                req.end('private request data')
              })
            } finally { agent.destroy() }
          } else if (client === 'fetch') {
            const res = await fetch(url, { method: 'POST', body: 'private request data' })
            body = await res.text()
          } else {
            const { request, Agent } = await import(client)
            const dispatcher = new Agent({ connect: { ca, checkServerIdentity() {} } })
            try {
              const res = await request(url, { dispatcher, method: 'POST', body: 'private request data' })
              body = await res.body.text()
            } finally { await dispatcher.close() }
          }
          console.log(JSON.stringify({ body, tracing }))
        } catch (err) {
          console.log(JSON.stringify({ code: err.cause?.code ?? err.code, tracing }))
        }
      `,
    ],
    {
      cwd,
      timeout: 10_000,
      env: {
        ...process.env,
        NODE_OPTIONS: options.preloadViaNodeOptions
          ? `--import=${testPreload}`
          : '',
        NODE_EXTRA_CA_CERTS:
          options.trust === false ? '' : join(directory, 'root.pem'),
        NODE_TLS_REJECT_UNAUTHORIZED: '1',
      },
    },
  )
  return JSON.parse(stdout)
}

test.each([
  'https',
  'https-custom-ca',
  'https-custom-check',
  'fetch',
  'undici_v6',
  'undici_v7',
  'undici_v8',
])(
  '%s rejects the blocked key and allows its sibling under the same root',
  async (client) => {
    expect(await request(client, blockedUrl)).toEqual({
      code: 'CERT_REVOKED',
      tracing: true,
    })
    expect(await request(client, allowedUrl)).toEqual({
      body: 'ok',
      tracing: true,
    })
    expect(blockedRequests).toBe(0)
  },
)

test.each(['https-from-tracing', 'fetch', 'undici_v7'])(
  '%s uses the preload from NODE_OPTIONS before tracing',
  async (client) => {
    const options = { preloadViaNodeOptions: true }
    expect(await request(client, blockedUrl, options)).toEqual({
      code: 'CERT_REVOKED',
      tracing: true,
    })
    expect(await request(client, allowedUrl, options)).toEqual({
      body: 'ok',
      tracing: true,
    })
    expect(blockedRequests).toBe(0)
  },
)

it('the blocked test chain works without the preload', async () => {
  const before = blockedRequests
  expect(await request('fetch', blockedUrl, { mitigation: false })).toEqual({
    body: 'ok',
    tracing: true,
  })
  expect(blockedRequests).toBe(before + 1)
  // @NOTE Other tests assert no rejected connection delivered an HTTP request.
  blockedRequests = 0
})

it('preserves normal hostname and trust checks', async () => {
  expect(await request('https', allowedUrl, { trust: false })).toMatchObject({
    code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  })
  expect(await request('https-bad-hostname', allowedUrl)).toMatchObject({
    code: 'ERR_TLS_CERT_ALTNAME_INVALID',
  })
})

it('matches all 16 published certificate variants using exactly eight SPKI hashes', async () => {
  const { stdout } = await run(
    execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict'
        import crypto from 'node:crypto'
        import { syncBuiltinESMExports } from 'node:module'
        import tls from 'node:tls'
        const { X509Certificate, createHash } = crypto
        let parses = 0
        crypto.X509Certificate = class extends X509Certificate {
          constructor(raw) { super(raw); parses++ }
        }
        syncBuiltinESMExports()
        let options
        tls.connect = (opts) => { options = opts }
        await import(${JSON.stringify(preload.href)})
        tls.connect({ checkServerIdentity() {} })
        const check = options.checkServerIdentity
        const hashes = new Set()
        for (const fixture of ${JSON.stringify(intermediates)}) {
          const x509 = new X509Certificate(fixture.pem)
          assert.equal(x509.fingerprint256.replaceAll(':', ''), fixture.sha256.toUpperCase())
          const hash = createHash('sha256').update(x509.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
          assert.equal(hash, fixture.spki_sha256.toLowerCase())
          hashes.add(hash)
          const cert = x509.toLegacyObject()
          assert.equal(check('localhost', cert)?.code, 'CERT_REVOKED')
          assert.equal(check('localhost', cert)?.code, 'CERT_REVOKED')
        }
        assert.equal(hashes.size, 8)
        assert.equal(parses, 16, 'cache avoids repeated X.509 parsing')
        const root = new X509Certificate(${JSON.stringify(fixture.root)}).toLegacyObject()
        root.issuerCertificate = root
        assert.equal(check('localhost', root), undefined)
        assert.equal(check('localhost', {} )?.code, 'ERR_TLS_CERT_CHAIN_CHECK')
        console.log('ok')
      `,
    ],
    { cwd, timeout: 10_000, env: { ...process.env, NODE_OPTIONS: '' } },
  )
  expect(stdout.trim()).toBe('ok')
})

it('preserves tls.connect overloads and synchronizes named ESM imports', async () => {
  const { stdout } = await run(
    execPath,
    [
      `--import=${testPreload}`,
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict'
        import { once } from 'node:events'
        import tls, { connect } from 'node:tls'
        const port = ${JSON.stringify(new URL(allowedUrl).port)}
        assert.equal(connect, tls.connect)
        for (const args of [
          [{ port, host: '127.0.0.1' }],
          [port, '127.0.0.1'],
          [port, '127.0.0.1', {}],
          [port, { host: '127.0.0.1' }],
          [port, undefined, { host: '127.0.0.1' }],
        ]) {
          let calls = 0
          const socket = connect(...args, () => { calls++ })
          await once(socket, 'secureConnect')
          assert.equal(calls, 1)
          socket.destroy()
        }
        console.log('ok')
      `,
    ],
    {
      cwd,
      timeout: 10_000,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        NODE_EXTRA_CA_CERTS: join(directory, 'root.pem'),
        NODE_TLS_REJECT_UNAUTHORIZED: '1',
      },
    },
  )
  expect(stdout.trim()).toBe('ok')
})

it('preserves custom validation errors and permits checked sessions to resume', async () => {
  const { stdout } = await run(
    execPath,
    [
      `--import=${testPreload}`,
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict'
        import { once } from 'node:events'
        import { connect } from 'node:tls'
        const options = {
          port: ${JSON.stringify(new URL(allowedUrl).port)},
          host: '127.0.0.1',
          maxVersion: 'TLSv1.2',
        }
        const failure = Object.assign(new Error('custom validation failed'), { code: 'CUSTOM_CHECK' })
        const rejected = connect({
          ...options,
          checkServerIdentity() { assert.equal(this.host, options.host); return failure },
        })
        await assert.rejects(once(rejected, 'secureConnect'), failure)
        let checks = 0
        options.checkServerIdentity = () => { checks++ }
        let session
        const first = connect(options)
        first.on('session', (value) => { session = value })
        await once(first, 'secureConnect')
        assert.equal(first.isSessionReused(), false)
        assert.ok(session)
        first.destroy()
        const resumed = connect({ ...options, session })
        await once(resumed, 'secureConnect')
        assert.equal(resumed.isSessionReused(), true)
        assert.equal(checks, 1)
        resumed.destroy()
        console.log('ok')
      `,
    ],
    {
      cwd,
      timeout: 10_000,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        NODE_EXTRA_CA_CERTS: join(directory, 'root.pem'),
        NODE_TLS_REJECT_UNAUTHORIZED: '1',
      },
    },
  )
  expect(stdout.trim()).toBe('ok')
})
