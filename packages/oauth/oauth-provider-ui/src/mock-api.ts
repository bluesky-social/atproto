import {
  API_ENDPOINT_PREFIX,
  type Account,
  type CustomizationData,
  type DeviceMetadata,
  type DidString,
} from '@atproto/oauth-provider-api'
import type { OAuthClientId, OAuthClientMetadata } from '@atproto/oauth-types'

export const currentDeviceId = 'device1' // Simulate that this device is "device1"

export const requestUri =
  window.location.pathname === '/authorization-page.html'
    ? 'urn:ietf:params:oauth:request_uri:req-123123123'
    : undefined

const PDS_DID = 'did:web:pds.bsky.social'

export const accounts = new Map<DidString, Account>(
  (
    [
      {
        did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
        pds: PDS_DID,
        deactivated: false,
        email: 'eric@foobar.com',
        emailVerified: true,
        name: 'Eric',
        handle: 'esb.lol',
        picture:
          'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
      },
      {
        did: 'did:plc:dpajgwmnecpdyjyqzjzm6bnb',
        pds: PDS_DID,
        deactivated: false,
        email: 'eric@foobar.com',
        emailVerified: false,
        name: 'Tom Sawyeeeeeeeeeee',
        handle: 'test.esb.lol',
        picture:
          'https://cdn.bsky.app/img/avatar/plain/did:plc:dpajgwmnecpdyjyqzjzm6bnb/bafkreia6dx7fhoi6fxwfpgm7jrxijpqci7ap53wpilkpazojwvqlmgud2m@jpeg',
      },
      {
        did: 'did:plc:matttmattmattmattmattmat',
        pds: PDS_DID,
        deactivated: false,
        email: 'matthieu@foobar.com',
        emailVerified: false,
        name: 'Matthieu',
        handle: 'matthieu.bsky.social',
        picture: /** @type {sting|undefined} */ undefined,
      },
      {
        did: 'did:plc:alice',
        pds: PDS_DID,
        deactivated: true,
        email: 'alice@test.com',
        emailVerified: true,
        name: 'Alice',
        handle: 'alice.test',
        picture: /** @type {sting|undefined} */ undefined,
      },
    ] satisfies Account[]
  ).map((a) => [a.did, a]),
)

const otpEnabledAccounts = new Set([
  'did:plc:matttmattmattmattmattmat',
  'did:plc:alice',
])

export const customizationData: CustomizationData = {
  availableUserDomains: ['.bsky.social', '.bsky.team'],
  inviteCodeRequired: false,
  // hcaptchaSiteKey: undefined,
  hcaptchaSiteKey: '10000000-ffff-ffff-ffff-000000000001',
  name: 'Bluesky',
  links: [
    {
      title: {
        en: 'Home',
        fr: 'Accueil',
        ja: 'ホーム',
        es: 'Inicio',
      },
      href: 'https://bsky.social/',
      rel: 'canonical', // prevents the login page from being indexed by search engines
    },
    {
      title: {
        en: 'Terms of Service',
        ja: '利用規約',
        es: 'Términos del servicio',
      },
      href: 'https://bsky.social/about/support/tos',
      rel: 'terms-of-service',
    },
    {
      title: {
        en: 'Privacy Policy',
        ja: 'プライバシーポリシー',
        es: 'Política de privacidad',
      },
      href: 'https://bsky.social/about/support/privacy-policy',
      rel: 'privacy-policy',
    },
    {
      title: {
        en: 'Support',
        ja: 'サポート',
        es: 'Soporte',
      },
      href: 'https://blueskyweb.zendesk.com/hc/en-us',
      rel: 'help',
    },
  ],
  logo: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 320 286"><path fill="rgb(10,122,255)" d="M69.364 19.146c36.687 27.806 76.147 84.186 90.636 114.439 14.489-30.253 53.948-86.633 90.636-114.439C277.107-.917 320-16.44 320 32.957c0 9.865-5.603 82.875-8.889 94.729-11.423 41.208-53.045 51.719-90.071 45.357 64.719 11.12 81.182 47.953 45.627 84.785-80 82.874-106.667-44.333-106.667-44.333s-26.667 127.207-106.667 44.333c-35.555-36.832-19.092-73.665 45.627-84.785-37.026 6.362-78.648-4.149-90.071-45.357C5.603 115.832 0 42.822 0 32.957 0-16.44 42.893-.917 69.364 19.147Z" /></svg>')}`,
}

const devices = new Map([
  [
    'device1',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      ipAddress: '192.0.0.1',
      lastSeenAt: new Date().toISOString() as any,
    },
  ],
  [
    'device2',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      ipAddress: '192.0.0.1',
      lastSeenAt: '2024-11-26T02:32:15.233Z',
    },
  ],
] satisfies [string, DeviceMetadata][])

const clients = new Map<string, OAuthClientMetadata | undefined>()

clients.set('https://bsky.app/oauth-client.json', {
  client_id: 'https://bsky.app/oauth-client.json',
  client_name: 'Bluesky',
  client_uri: 'https://bsky.app',
  logo_uri: 'https://web-cdn.bsky.app/static/apple-touch-icon.png',
  redirect_uris: ['https://bsky.app/oauth-callback'],
  scope: 'atproto transition:generic transition:chat.bsky',
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'client_secret_basic',
  application_type: 'native',
  subject_type: 'public',
  authorization_signed_response_alg: 'RS256',
})

// Unable to load metadata for this client:
clients.set('https://example.com/oauth-client.json', undefined)

export const accountDeviceSessions = new Map<
  string,
  Array<{
    did: DidString
    remember: boolean
    loginRequired: boolean
  }>
>([
  [
    'device1',
    [
      {
        did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
        remember: true,
        loginRequired: true,
      },
      {
        did: 'did:plc:dpajgwmnecpdyjyqzjzm6bnb',
        remember: false,
        loginRequired: false,
      },
    ],
  ],
  [
    'device2',
    [
      {
        did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
        remember: true,
        loginRequired: false,
      },
    ],
  ],
])

const accountOAuthSessions = new Map<
  DidString,
  Array<{
    tokenId: string
    createdAt: string
    updatedAt: string
    clientId: OAuthClientId
    scope?: string
  }>
>([
  [
    'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
    [
      {
        tokenId: 'token1',
        createdAt: '2023-10-01T00:00:00.000Z',
        updatedAt: '2025-10-01T00:00:00.000Z',
        clientId: 'https://bsky.app/oauth-client.json',
        scope: 'atproto transition:generic transition:chat.bsky',
      },
    ],
  ],
  [
    'did:plc:dpajgwmnecpdyjyqzjzm6bnb',
    [
      {
        tokenId: 'token2',
        createdAt: '2023-10-01T00:00:00.000Z',
        updatedAt: '2023-10-01T00:00:00.000Z',
        clientId: 'https://bsky.app/oauth-client.json',
        scope:
          'atproto transition:generic transition:email transition:chat.bsky',
      },
      {
        tokenId: 'token3',
        createdAt: '2024-08-01T00:00:00.000Z',
        updatedAt: '2025-10-01T00:00:00.000Z',
        clientId: 'https://example.com/oauth-client.json',
        scope: undefined,
      },
    ],
  ],
])

export function buildMockFetch(origFetch = window.fetch): typeof window.fetch {
  return async function mockFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const request =
      input instanceof Request && init == null
        ? input
        : new Request(input, init)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    const { method } = request
    const url = new URL(request.url)

    console.log(`Fetching: ${method} ${url.pathname}${url.search}`)
    switch (`${method} ${url.pathname}`) {
      case `POST ${API_ENDPOINT_PREFIX}/sign-up`: {
        const { locale, handle, email } = await request.json()

        for (const existing of accounts.values()) {
          if (existing.handle === handle) {
            return Response.json(
              {
                error: 'handle_unavailable',
                reason: 'taken',
                error_description: `Handle already taken: ${handle}`,
              },
              { status: 400 },
            )
          }
          if (existing.email === email) {
            return Response.json(
              {
                error: 'invalid_request',
                error_description: 'Email already taken',
              },
              { status: 400 },
            )
          }
        }

        const did: DidString = `did:plc:mock${Math.floor(
          (performance.now() % 1) * 1e12,
        )
          .toString(36)
          .padStart(8, '0')}`
        const account: Account = {
          did,
          pds: PDS_DID,
          deactivated: false,
          locale,
          email,
          emailVerified: false,
          handle,
          name: handle,
          picture: undefined,
        }
        accounts.set(did, account)
        accountDeviceSessions.set(
          currentDeviceId,
          (accountDeviceSessions.get(currentDeviceId) ?? []).concat({
            did,
            remember: true,
            loginRequired: false,
          }),
        )
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/sign-in`: {
        const { username, remember, emailOtp } = await request.json()
        for (const [did, account] of accounts) {
          if (account.email === username || account.handle === username) {
            if (
              otpEnabledAccounts.has(account.did) &&
              emailOtp !== 'AAAAA-AAAAA'
            ) {
              return Response.json(
                {
                  error: 'second_authentication_factor_required',
                  error_description: emailOtp
                    ? 'Invalid OTP code'
                    : 'OTP code required',
                  type: 'emailOtp',
                  hint: account.email,
                },
                { status: 400 },
              )
            }

            accountDeviceSessions.set(
              currentDeviceId,
              (
                accountDeviceSessions
                  .get(currentDeviceId)
                  ?.filter((s) => s.did !== did) ?? []
              ).concat({ did, remember, loginRequired: false }),
            )

            return Response.json({ account })
          }
        }
        return Response.json(
          {
            error: 'invalid_request',
            error_description: 'Invalid identifier or password',
          },
          { status: 400 },
        )
      }
      case `GET ${API_ENDPOINT_PREFIX}/device-sessions`:
        return Response.json(
          accountDeviceSessions.get(currentDeviceId)?.map((s) => ({
            account: accounts.get(s.did),
            loginRequired: s.loginRequired,
          })) ?? [],
        )
      case `GET ${API_ENDPOINT_PREFIX}/oauth-sessions`: {
        const did = url.searchParams.get('did') as DidString
        return Response.json(
          accountOAuthSessions.get(did)?.map((oauthSession) => ({
            ...oauthSession,
            clientMetadata: clients.get(oauthSession.clientId),
          })) ?? [],
        )
      }
      case `POST ${API_ENDPOINT_PREFIX}/revoke-oauth-session`: {
        const { did, tokenId } = await request.json()
        accountOAuthSessions.set(
          did,
          accountOAuthSessions.get(did)?.filter((s) => s.tokenId !== tokenId) ??
            [],
        )
        return Response.json({ success: true })
      }
      case `GET ${API_ENDPOINT_PREFIX}/account-sessions`: {
        const did = url.searchParams.get('did')
        return Response.json(
          Array.from(
            accountDeviceSessions.entries(),
            ([deviceId, deviceSession]) =>
              deviceSession
                .filter((s) => s.did === did)
                .map(() => ({
                  deviceId,
                  deviceMetadata: devices.get(deviceId),
                  isCurrentDevice: deviceId === currentDeviceId,
                })),
          ).flat(),
        )
      }
      case `POST ${API_ENDPOINT_PREFIX}/sign-out`: {
        const { did } = await request.json()
        accountDeviceSessions.set(
          currentDeviceId,
          accountDeviceSessions
            .get(currentDeviceId)
            ?.filter((s) => s.did !== did) ?? [],
        )
        return Response.json({ success: true })
      }
      case `POST ${API_ENDPOINT_PREFIX}/revoke-account-session`: {
        const { did, deviceId } = await request.json()
        accountDeviceSessions.set(
          deviceId,
          accountDeviceSessions.get(deviceId)?.filter((s) => s.did !== did) ??
            [],
        )
        return Response.json({ success: true })
      }
      case `POST ${API_ENDPOINT_PREFIX}/verify-handle-availability`:
        return Response.json({ available: true })
      case `POST ${API_ENDPOINT_PREFIX}/reset-password-request`:
        return Response.json({ success: true })
      case `POST ${API_ENDPOINT_PREFIX}/reset-password-confirm`:
        return Response.json({ success: true })
      case `POST ${API_ENDPOINT_PREFIX}/update-email-request`: {
        const { did } = await request.json()
        if (!accounts.has(did)) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }

        const tokenRequired = accounts.get(did)?.emailVerified === true

        return Response.json({ tokenRequired })
      }
      case `POST ${API_ENDPOINT_PREFIX}/update-email-confirm`: {
        const { did, token, email } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }

        const tokenRequired = accounts.get(did)?.emailVerified === true

        if (tokenRequired && token !== 'AAAAA-AAAAA') {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Invalid token',
            },
            { status: 400 },
          )
        }
        // Mirror the real behavior: changing email resets the
        // emailVerified flag and triggers a new verification email.
        account.email = email
        account.emailVerified = false
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/verify-email-request`: {
        const { did } = await request.json()
        if (!accounts.has(did)) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        return Response.json({ success: true })
      }
      case `POST ${API_ENDPOINT_PREFIX}/update-handle`: {
        const { did, handle } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }

        if (handle.endsWith('resolve.error')) {
          return Response.json(
            {
              error: 'handle_unavailable',
              reason: 'resolution',
              error_description: 'External handle did not resolve to DID',
            },
            { status: 400 },
          )
        }

        for (const [otherSub, otherAccount] of accounts) {
          if (otherSub !== did && otherAccount.handle === handle) {
            return Response.json(
              {
                error: 'handle_unavailable',
                reason: 'taken',
                error_description: `Handle already taken: ${handle}`,
              },
              { status: 400 },
            )
          }
        }
        account.handle = handle
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/verify-email-confirm`: {
        const { did, token, email } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        if (token !== 'AAAAA-AAAAA') {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Invalid token',
            },
            { status: 400 },
          )
        }
        if (account.email !== email) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Email mismatch',
            },
            { status: 400 },
          )
        }
        account.emailVerified = true
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/deactivate-account`: {
        const { did } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        account.deactivated = true
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/reactivate-account`: {
        const { did } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        account.deactivated = false
        return Response.json({ account })
      }
      case `POST ${API_ENDPOINT_PREFIX}/delete-account-request`: {
        const { did } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        return Response.json({ success: true })
      }
      case `POST ${API_ENDPOINT_PREFIX}/delete-account-confirm`: {
        const { did, token, password } = await request.json()
        const account = accounts.get(did)
        if (!account) {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Unknown account',
            },
            { status: 400 },
          )
        }
        if (token !== 'AAAAA-AAAAA') {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Invalid token (expected: "AAAAA-AAAAA")',
            },
            { status: 400 },
          )
        }
        if (password !== 'password') {
          return Response.json(
            {
              error: 'invalid_request',
              error_description: 'Invalid password (expected: "password")',
            },
            { status: 400 },
          )
        }
        accounts.delete(did)
        accountOAuthSessions.delete(did)
        for (const [deviceId, sessions] of accountDeviceSessions) {
          accountDeviceSessions.set(
            deviceId,
            sessions.filter((s) => s.did !== did),
          )
        }
        return Response.json({ success: true })
      }
    }

    return origFetch(input, init)
  }
}
