import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { type Server, createServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { AccountStore } from '../account/account-store.js'
import { Client } from '../client/client.js'
import type { DeviceId } from '../device/device-id.js'
import { asHandler } from '../lib/http/middleware.js'
import {
  AccessTokenMode,
  JoseKey,
  Keyset,
  OAuthProvider,
} from '../oauth-provider.js'
import { createApiMiddleware } from './create-api-middleware.js'

/**
 * The `/consent` route must record the scopes the user approved, not the ones
 * the client requested. This drives the route over HTTP because the defect is in
 * the route: `RequestManager.setAuthorized()` narrows the code correctly, so
 * calling the managers directly shows nothing wrong.
 */

const ISSUER = 'https://bsky.social'
const DID = 'did:plc:consentconsentconsent'
const CLIENT_ID = 'https://client.example/client-metadata.json'
const DEVICE_ID = `dev-${'a'.repeat(32)}` as DeviceId
const SESSION_ID = 'ses-' + 'b'.repeat(32)
const CSRF = 'c'.repeat(24)

const REQUESTED = 'atproto account:email'
const APPROVED = 'atproto'

const clientMetadata = {
  client_id: CLIENT_ID,
  client_name: 'Client',
  client_uri: 'https://client.example',
  redirect_uris: ['https://client.example/cb'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  scope: REQUESTED,
  token_endpoint_auth_method: 'client_secret_basic',
  dpop_bound_access_tokens: true,
  application_type: 'web',
}

const account = {
  did: DID,
  handle: 'user.test',
  email: 'user@example.com',
  emailVerified: true,
  emailAuthFactor: false,
  deactivated: false,
  pds: 'did:web:pds.test',
}

const authorizationRequest: OAuthAuthorizationRequestParameters = {
  client_id: CLIENT_ID,
  redirect_uri: 'https://client.example/cb',
  response_type: 'code',
  scope: REQUESTED,
  code_challenge: 'a'.repeat(43),
  code_challenge_method: 'S256',
  state: 'xyz',
}

describe('/consent records the approved scopes', () => {
  let server: Server
  let provider: OAuthProvider
  let authorizedClients: Map<
    string,
    Map<string, { authorizedScopes: readonly string[] }>
  >

  beforeAll(async () => {
    authorizedClients = new Map()
    const requests = new Map()
    const devices = new Map<string, Record<string, unknown>>([
      [
        DEVICE_ID,
        {
          sessionId: SESSION_ID,
          ipAddress: '203.0.113.9',
          userAgent: 'test',
          lastSeenAt: new Date(),
        },
      ],
    ])
    const deviceAccounts = new Map([
      [`${DEVICE_ID}|${DID}`, { createdAt: new Date(), updatedAt: new Date() }],
    ])
    const noop = async () => {}

    // Only the members this test reaches are real; the rest are inert.
    const store = {
      authenticateAccount: noop,
      createAccount: noop,
      deactivateAccount: noop,
      deleteAccountConfirm: noop,
      deleteAccountRequest: noop,
      enableEmailAuthFactor: noop,
      disableEmailAuthFactor: noop,
      getAccount: async (did: string) => ({
        account: { ...account, did },
        authorizedClients: authorizedClients.get(did) ?? new Map(),
      }),
      getDeviceAccount: async (deviceId: string, did: string) => {
        const row = deviceAccounts.get(`${deviceId}|${did}`)
        if (!row) return null
        return {
          deviceId,
          deviceData: devices.get(deviceId),
          account: { ...account, did },
          authorizedClients: authorizedClients.get(did) ?? new Map(),
          ...row,
        }
      },
      listDeviceAccounts: async (filter: {
        deviceId?: string
        did?: string
      }) => {
        const out = []
        for (const [key, row] of deviceAccounts) {
          const [deviceId, did] = key.split('|')
          if (filter.deviceId && filter.deviceId !== deviceId) continue
          if (filter.did && filter.did !== did) continue
          out.push({
            deviceId,
            deviceData: devices.get(deviceId),
            account: { ...account, did },
            authorizedClients: authorizedClients.get(did) ?? new Map(),
            ...row,
          })
        }
        return out
      },
      reactivateAccount: noop,
      removeDeviceAccount: noop,
      resetPasswordConfirm: noop,
      resetPasswordRequest: noop,
      async setAuthorizedClient(did: string, clientId: string, data: never) {
        const byClient = authorizedClients.get(did) ?? new Map()
        byClient.set(clientId, data)
        authorizedClients.set(did, byClient)
      },
      updateEmailConfirm: noop,
      updateEmailRequest: async () => ({ tokenRequired: false }),
      updateHandle: noop,
      upsertDeviceAccount: noop,
      verifyEmailConfirm: noop,
      verifyEmailRequest: noop,
      verifyHandleAvailability: noop,
      createDevice: async (id: string, data: never) => devices.set(id, data),
      readDevice: async (id: string) => devices.get(id) ?? null,
      updateDevice: async (id: string, data: Record<string, unknown>) =>
        devices.set(id, { ...devices.get(id), ...data }),
      deleteDevice: async (id: string) => devices.delete(id),
      findLexicon: async () => null,
      storeLexicon: noop,
      deleteLexicon: noop,
      createRequest: async (id: string, data: never) => requests.set(id, data),
      readRequest: async (id: string) => requests.get(id) ?? null,
      async updateRequest(id: string, data: Record<string, unknown>) {
        const current = requests.get(id)
        if (current) requests.set(id, { ...current, ...data })
      },
      deleteRequest: async (id: string) => requests.delete(id),
      consumeRequestCode: async (code: string) => {
        for (const [id, data] of requests) {
          if ((data as { code?: string }).code === code) {
            requests.delete(id)
            return { requestId: id, data }
          }
        }
        return null
      },
      createToken: noop,
      readToken: async () => null,
      deleteToken: noop,
      rotateToken: noop,
      findTokenByRefreshToken: async () => null,
      findTokenByCode: async () => null,
      listAccountTokens: async () => [],
      unique: async () => true,
      findClient: async () => clientMetadata,
    }

    const keyset = new Keyset([
      await JoseKey.fromKeyLike(crypto.randomBytes(32), 'k1', 'HS256'),
    ])

    provider = new OAuthProvider({
      store: store as unknown as AccountStore,
      issuer: ISSUER,
      keyset,
      safeFetch: globalThis.fetch,
      accessTokenMode: AccessTokenMode.stateless,
    })

    // Client resolution is stubbed: this test is about the consent route, and a
    // real fetch of client metadata is not what is under test.
    provider.clientManager.getClient = async () =>
      new Client(CLIENT_ID, clientMetadata as never, undefined, {
        isFirstParty: false,
        isTrusted: false,
      })

    // Only the API router: the full oauthMiddleware also pulls in the UI asset
    // bundle, which is a build artifact this test has no business needing.
    server = createServer(asHandler(createApiMiddleware(provider, {})))
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  /**
   * Posts to the provider's API with the headers a same-origin form submission
   * carries. node:http rather than fetch(): Sec-Fetch-* are forbidden header
   * names, so fetch() rewrites them to "cors" and the route rejects the request.
   */
  const authorizeQuery = (requestUri: string) =>
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: 'https://client.example/cb',
      response_type: 'code',
      scope: REQUESTED,
      code_challenge: 'a'.repeat(43),
      code_challenge_method: 'S256',
      state: 'xyz',
      request_uri: requestUri,
    })

  const postConsent = (body: unknown, requestUri: string) =>
    new Promise<{ status: number; body: string }>((resolve) => {
      const payload = JSON.stringify(body)
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: (server.address() as AddressInfo).port,
          method: 'POST',
          path: '/@atproto/oauth-provider/~api/consent',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
            cookie: `dev-id=${DEVICE_ID}; ses-id=${SESSION_ID}; csrf-token=${CSRF}`,
            'x-csrf-token': CSRF,
            'sec-fetch-mode': 'same-origin',
            'sec-fetch-site': 'same-origin',
            origin: ISSUER,
            referer: `${ISSUER}/oauth/authorize?${authorizeQuery(requestUri)}`,
          },
        },
        (res) => {
          let text = ''
          res.on('data', (chunk) => (text += chunk))
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, body: text }),
          )
        },
      )
      req.on('error', () => resolve({ status: 0, body: '' }))
      req.end(payload)
    })

  const createRequest = async () => {
    const client = await provider.clientManager.getClient(CLIENT_ID)
    const { requestUri } =
      await provider.requestManager.createAuthorizationRequest(
        client,
        { method: 'none' },
        authorizationRequest,
        DEVICE_ID,
      )
    return requestUri
  }

  const recorded = () =>
    authorizedClients.get(DID)?.get(CLIENT_ID)?.authorizedScopes ?? []

  it('records what the user approved when they untick a requested scope', async () => {
    const requestUri = await createRequest()

    const { status, body } = await postConsent(
      { did: DID, scope: APPROVED },
      requestUri,
    )

    assert(status === 200, `consent failed: ${status} ${body}`)
    // A code is issued either way, so its presence proves nothing on its own.
    expect(body).toContain('code=')

    expect(recorded()).toContain('atproto')
    expect(recorded()).not.toContain('account:email')
  })

  it('does not silently grant the dropped scope on a later prompt=none request', async () => {
    const requestUri = await createRequest()
    const { status, body } = await postConsent(
      { did: DID, scope: APPROVED },
      requestUri,
    )
    assert(status === 200, `consent failed: ${status} ${body}`)

    const result = await Promise.resolve()
      .then(() =>
        provider.authorize(
          {
            ...authorizationRequest,
            prompt: 'none',
            login_hint: 'user.test',
          } as never,
          {
            deviceId: DEVICE_ID as never,
            deviceMetadata: {
              ipAddress: '203.0.113.9',
              userAgent: 'test',
              port: 443,
            },
          },
        ),
      )
      .then(
        (value) => ({ ok: true, value }),
        (err: unknown) => ({ ok: false, err }),
      )

    // The dropped permission must still require consent, so this must not be a
    // silent success carrying a code.
    expect(result).toMatchObject({ ok: false })

    const authorizedScopes = recorded()
    expect(authorizedScopes).toContain('atproto')
    expect(authorizedScopes).not.toContain('account:email')
  })
})
