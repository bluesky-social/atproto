import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { didSchema } from '@atproto/did'
import type { Account } from '@atproto/oauth-provider-api'
import type { DeviceAccount } from '../account/account-store.js'
import type { DeviceInfo } from '../device/device-manager.js'
import { OAuthProvider } from '../oauth-provider.js'
import { createFedcmMiddleware } from './create-fedcm-middleware.js'

const issuer = 'https://idp.example'
const clientId = 'https://rp.example/oauth-client-metadata.json'
const account = {
  did: didSchema.parse('did:plc:2ihkmqhirw5tturitpdyf2fa'),
  pds: didSchema.parse('did:web:pds.example.com'),
  deactivated: false,
  email: 'private@example.com',
  handle: 'alice.example',
  name: 'Alice Example',
} as Account

const deviceInfo = {
  deviceId: 'dev-0123456789abcdef0123456789abcdef',
  deviceMetadata: { ipAddress: '127.0.0.1', port: 1234 },
} as DeviceInfo

const deviceAccount = { account, updatedAt: new Date() } as DeviceAccount
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()))
        }),
    ),
  )
})

describe('createFedcmMiddleware', () => {
  it('serves discovery and config only when enabled', async () => {
    const disabled = await listen(provider({ fedcm: false }))
    const disabledResponse = await fetch(`${disabled}/.well-known/web-identity`)
    expect(disabledResponse.status).toBe(404)

    const origin = await listen(provider())
    const discovery = await fetch(`${origin}/.well-known/web-identity`)
    expect(discovery.status).toBe(200)
    expect(discovery.headers.get('cache-control')).toBe('max-age=300')
    expect(await discovery.json()).toEqual({
      provider_urls: [`${issuer}/oauth/fedcm/config.json`],
    })

    const config = await fetch(`${origin}/oauth/fedcm/config.json`)
    expect(await config.json()).toEqual({
      accounts_endpoint: `${issuer}/oauth/fedcm/accounts`,
      id_assertion_endpoint: `${issuer}/oauth/fedcm/assertion`,
      login_url: `${issuer}/account/sign-in?fedcm=true`,
      types: ['https://atproto.com'],
    })
  })

  it('advertises the atproto federation type in the config', async () => {
    const origin = await listen(provider())
    const config = await fetch(`${origin}/oauth/fedcm/config.json`)
    expect(((await config.json()) as { types: string[] }).types).toEqual([
      'https://atproto.com',
    ])
  })

  it('returns eligible account display data from the read-only shadow session', async () => {
    const fake = provider()
    const origin = await listen(fake)
    const response = await fetch(`${origin}/oauth/fedcm/accounts`, {
      headers: {
        accept: 'application/json',
        cookie: 'fedcm-session=active',
        origin: 'https://rp.example',
        'sec-fetch-dest': 'webidentity',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    expect(response.headers.get('vary')).toContain('Origin')
    expect(await response.json()).toEqual({
      accounts: [
        {
          id: account.did,
          username: `@${account.handle}`,
          name: account.name,
        },
      ],
    })
    expect(fake.deviceManager.readFedcmDevice).toHaveBeenCalledOnce()
    expect(fake.deviceManager.load).not.toHaveBeenCalled()

    const originFree = await fetch(`${origin}/oauth/fedcm/accounts`, {
      headers: { 'sec-fetch-dest': 'webidentity' },
    })
    expect(originFree.status).toBe(200)
    expect(originFree.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects non-FedCM requests and does not reflect rejected assertion origins', async () => {
    const fake = provider()
    const origin = await listen(fake)
    const wrongDest = await fetch(`${origin}/oauth/fedcm/accounts`, {
      headers: { origin: 'https://rp.example' },
    })
    expect(wrongDest.status).toBe(400)

    const rejected = await assertion(origin, {
      origin: 'https://attacker.example',
    })
    expect(rejected.status).toBe(403)
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull()
    expect(fake.deviceManager.readFedcmDevice).not.toHaveBeenCalled()
    expect(fake.clientManager.getClient).not.toHaveBeenCalled()

    const nullOrigin = await assertion(origin, { origin: 'null' })
    expect(nullOrigin.status).toBe(400)
    expect(nullOrigin.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('returns a signed token for an eligible device account', async () => {
    const fake = provider()
    const origin = await listen(fake)
    const response = await assertion(origin, { origin: 'https://rp.example' })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://rp.example',
    )
    expect(await response.json()).toEqual({ token: 'signed.jwt.token' })
    expect(fake.createFedcmIdToken).toHaveBeenCalledWith(
      deviceAccount,
      clientId,
      'n-123',
    )
    expect(fake.clientManager.getClient).toHaveBeenCalledWith(clientId)
    expect(fake.pushedAuthorizationRequest).not.toHaveBeenCalled()
    expect(fake.token).not.toHaveBeenCalled()
  })

  it('rejects malformed params', async () => {
    const nonce = 'n-123'
    const cases: (string | null)[] = [
      null,
      '',
      'not json',
      '"x"',
      'null',
      '[]',
      '{}',
      JSON.stringify({ response_type: 'code', nonce }),
      JSON.stringify({ response_type: 'id_token' }),
      JSON.stringify({ response_type: 'id_token', nonce: '' }),
      JSON.stringify({ response_type: 'id_token', nonce: 'a'.repeat(257) }),
      JSON.stringify({
        request_uri: 'urn:x',
        response_type: 'id_token',
        nonce,
      }),
    ]
    const fake = provider()
    const origin = await listen(fake)

    for (const params of cases) {
      const response = await assertion(origin, {
        origin: 'https://rp.example',
        params,
      })
      expect(response.status, String(params)).toBe(400)
      expect(await response.json()).toEqual({
        error: { code: 'invalid_request' },
      })
    }
    expect(fake.createFedcmIdToken).not.toHaveBeenCalled()
  })

  it('requires a FedCM device session', async () => {
    const fake = provider({ device: null })
    const origin = await listen(fake)
    const response = await assertion(origin, { origin: 'https://rp.example' })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'login_required' } })
    expect(fake.createFedcmIdToken).not.toHaveBeenCalled()
  })

  it('refuses accounts that are not eligible on this device', async () => {
    const fake = provider({ accounts: [] })
    const origin = await listen(fake)
    const response = await assertion(origin, { origin: 'https://rp.example' })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'login_required' } })
    expect(fake.listFedcmAccounts).toHaveBeenCalledWith(deviceInfo.deviceId)
    expect(fake.createFedcmIdToken).not.toHaveBeenCalled()
  })

  it('only accepts loopback clients when explicitly enabled and their redirect origin matches', async () => {
    const loopbackClientId =
      'http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A43210%2Fcallback'
    const withoutOptIn = provider()
    const withoutOptInOrigin = await listen(withoutOptIn)
    const rejected = await assertion(withoutOptInOrigin, {
      clientId: loopbackClientId,
      origin: 'http://127.0.0.1:43210',
    })
    expect(rejected.status).toBe(403)

    const withOptIn = provider({
      fedcm: { allowLoopbackClients: true },
      redirectUris: ['http://127.0.0.1:43210/callback'],
    })
    const withOptInOrigin = await listen(withOptIn)
    const accepted = await assertion(withOptInOrigin, {
      clientId: loopbackClientId,
      origin: 'http://127.0.0.1:43210',
    })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toEqual({ token: 'signed.jwt.token' })
  })

  it('requires an existing shadow session for the accounts endpoint', async () => {
    const fake = provider({ device: null })
    const origin = await listen(fake)
    const accounts = await fetch(`${origin}/oauth/fedcm/accounts`, {
      headers: { 'sec-fetch-dest': 'webidentity' },
    })

    expect(accounts.status).toBe(401)
    expect(fake.deviceManager.readFedcmDevice).toHaveBeenCalledOnce()
    expect(fake.listFedcmAccounts).not.toHaveBeenCalled()
  })

  it('filters deactivated, stale and handle-less accounts from the FedCM account list', async () => {
    const now = new Date()
    const staleAccount = {
      ...account,
      did: didSchema.parse('did:plc:ewvi7nxzyoun6zhxrhs64oiz'),
    }
    const deactivatedAccount = {
      ...account,
      did: didSchema.parse('did:plc:z72i7hdynmk6r22z27h6tvur'),
      deactivated: true,
    }
    // A DID is not user readable, so an account with no handle can't be shown.
    const handlelessAccount = {
      ...account,
      did: didSchema.parse('did:plc:44ybard66vv44zksje25o7dz'),
      handle: undefined,
    }
    const deviceAccounts = [
      { account, updatedAt: now },
      { account: staleAccount, updatedAt: new Date(now.getTime() - 60_000) },
      { account: deactivatedAccount, updatedAt: now },
      { account: handlelessAccount, updatedAt: now },
    ] as DeviceAccount[]
    const fake = {
      accountManager: {
        listDeviceAccounts: vi.fn(async () => deviceAccounts),
      },
      authenticationMaxAge: 30_000,
      checkLoginRequired: OAuthProvider.prototype.checkLoginRequired,
    } as unknown as OAuthProvider

    const result = await OAuthProvider.prototype.listFedcmAccounts.call(
      fake,
      deviceInfo.deviceId,
    )

    expect(result.map(({ account }) => account.did)).toEqual([account.did])
    expect(fake.accountManager.listDeviceAccounts).toHaveBeenCalledWith(
      deviceInfo.deviceId,
    )
  })
})

async function listen(fake: ReturnType<typeof provider>): Promise<string> {
  const middleware = createFedcmMiddleware(fake as unknown as OAuthProvider, {})
  const server = createServer((req, res) => {
    middleware(req, res, () => {
      res.writeHead(404).end()
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

function provider({
  fedcm = {},
  accounts = [deviceAccount],
  redirectUris = ['https://rp.example/callback'],
  device = deviceInfo,
}: {
  fedcm?: false | { allowLoopbackClients?: boolean }
  accounts?: DeviceAccount[]
  redirectUris?: string[]
  device?: DeviceInfo | null
} = {}) {
  return {
    issuer,
    fedcm,
    deviceManager: {
      readFedcmDevice: vi.fn(async () => device),
      load: vi.fn(),
    },
    createFedcmIdToken: vi.fn(async () => 'signed.jwt.token'),
    listFedcmAccounts: vi.fn(async () => accounts),
    clientManager: {
      getClient: vi.fn(async (id: string) => ({
        id,
        metadata: { redirect_uris: redirectUris },
      })),
    },
    pushedAuthorizationRequest: vi.fn(),
    token: vi.fn(),
  }
}

async function assertion(
  origin: string,
  {
    clientId: requestedClientId = clientId,
    accountId = account.did,
    origin: rpOrigin,
    params = JSON.stringify({ response_type: 'id_token', nonce: 'n-123' }),
  }: {
    clientId?: string
    accountId?: string
    origin: string
    params?: string | null
  },
): Promise<Response> {
  return fetch(`${origin}/oauth/fedcm/assertion`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      origin: rpOrigin,
      'sec-fetch-dest': 'webidentity',
    },
    body: new URLSearchParams({
      account_id: accountId,
      client_id: requestedClientId,
      disclosure_text_shown: 'true',
      is_auto_selected: 'false',
      ...(params === null ? {} : { params }),
    }),
  })
}
