import { describe, expect, it, test, vi } from 'vitest'
import {
  CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
  CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
  PUBLIC_CLIENT_REFRESH_LIFETIME,
  PUBLIC_CLIENT_SESSION_LIFETIME,
} from '../oauth-constants.js'
import { AccessTokenMode, TokenManager } from './token-manager.js'
import {
  isOAuthSessionActive,
  usesExtendedOAuthSessionLifetime,
} from './token-session.js'
import { type TokenInfo, type TokenStore, asTokenStore } from './token-store.js'

const NOW = new Date('2026-07-11T12:00:00.000Z')
const ACCOUNT_DID = 'did:example:alice'
const OTHER_ACCOUNT_DID = 'did:example:bob'
const PDS_DID = 'did:web:pds.example'
const CLIENT_ID = 'https://client.example/oauth-client-metadata.json'
const TOKEN_ID = `tok-${'0'.repeat(32)}` as TokenInfo['id']
const REFRESH_TOKEN = `ref-${'0'.repeat(64)}` as NonNullable<
  TokenInfo['currentRefreshToken']
>

function createTokenInfo({
  accountDid = ACCOUNT_DID,
  createdAt = new Date(NOW.getTime() - 60_000),
  updatedAt = new Date(NOW.getTime() - 60_000),
  expiresAt,
  currentRefreshToken,
  clientAuth = { method: 'none' },
}: {
  accountDid?: TokenInfo['account']['did']
  createdAt?: Date
  updatedAt?: Date
  expiresAt: Date
  currentRefreshToken: TokenInfo['currentRefreshToken']
  clientAuth?: TokenInfo['data']['clientAuth']
}): TokenInfo {
  return {
    id: TOKEN_ID,
    account: {
      did: accountDid,
      pds: PDS_DID,
      deactivated: false,
    },
    currentRefreshToken,
    data: {
      createdAt,
      updatedAt,
      expiresAt,
      clientId: CLIENT_ID,
      clientAuth,
      deviceId: null,
      did: accountDid,
      parameters: {
        client_id: CLIENT_ID,
        response_type: 'code',
      },
      code: null,
      scope: null,
    },
  }
}

function createTokenManager(tokenInfos: TokenInfo[]) {
  const listAccountTokens = vi.fn<TokenStore['listAccountTokens']>(
    async () => tokenInfos,
  )
  const store = asTokenStore({
    createToken: async () => {},
    readToken: async () => null,
    deleteToken: async () => {},
    rotateToken: async () => {},
    findTokenByRefreshToken: async () => null,
    findTokenByCode: async () => null,
    listAccountTokens,
  })

  const manager = new TokenManager(
    store,
    null as never,
    null as never,
    {},
    AccessTokenMode.stateless,
  )

  return { manager, listAccountTokens }
}

describe(isOAuthSessionActive, () => {
  test.each([
    {
      note: 'unexpired access token without refresh token',
      expiresAt: new Date(NOW.getTime() + 1),
      currentRefreshToken: null,
      usesExtendedSessionLifetime: false,
      expected: true,
    },
    {
      note: 'expired access token without refresh token',
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: null,
      usesExtendedSessionLifetime: false,
      expected: false,
    },
    {
      note: 'access token exactly at its expiry',
      expiresAt: new Date(NOW),
      currentRefreshToken: null,
      usesExtendedSessionLifetime: false,
      expected: false,
    },
    {
      note: 'refreshable public session with expired access token',
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: false,
      expected: true,
    },
    {
      note: 'public session exactly at its lifetime boundaries',
      createdAt: new Date(NOW.getTime() - PUBLIC_CLIENT_SESSION_LIFETIME),
      updatedAt: new Date(NOW.getTime() - PUBLIC_CLIENT_REFRESH_LIFETIME),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: false,
      expected: true,
    },
    {
      note: 'public session past its total lifetime',
      createdAt: new Date(NOW.getTime() - PUBLIC_CLIENT_SESSION_LIFETIME - 1),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: false,
      expected: false,
    },
    {
      note: 'public session past its refresh inactivity lifetime',
      updatedAt: new Date(NOW.getTime() - PUBLIC_CLIENT_REFRESH_LIFETIME - 1),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: false,
      expected: false,
    },
    {
      note: 'extended session past public client lifetime',
      createdAt: new Date(NOW.getTime() - PUBLIC_CLIENT_SESSION_LIFETIME - 1),
      updatedAt: new Date(NOW.getTime() - PUBLIC_CLIENT_REFRESH_LIFETIME - 1),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: true,
      expected: true,
    },
    {
      note: 'extended session past its total lifetime',
      createdAt: new Date(
        NOW.getTime() - CONFIDENTIAL_CLIENT_SESSION_LIFETIME - 1,
      ),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: true,
      expected: false,
    },
    {
      note: 'extended session past its refresh inactivity lifetime',
      updatedAt: new Date(
        NOW.getTime() - CONFIDENTIAL_CLIENT_REFRESH_LIFETIME - 1,
      ),
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      usesExtendedSessionLifetime: true,
      expected: false,
    },
  ])(
    '$note',
    ({
      createdAt,
      updatedAt,
      expiresAt,
      currentRefreshToken,
      usesExtendedSessionLifetime,
      expected,
    }) => {
      const tokenInfo = createTokenInfo({
        createdAt,
        updatedAt,
        expiresAt,
        currentRefreshToken,
      })

      expect(
        isOAuthSessionActive(
          tokenInfo,
          usesExtendedSessionLifetime,
          NOW.getTime(),
        ),
      ).toBe(expected)
    },
  )
})

describe(usesExtendedOAuthSessionLifetime, () => {
  test.each([
    {
      note: 'loaded public client',
      clientAuth: { method: 'none' } as const,
      client: { isConfidential: false, isFirstParty: false },
      expected: false,
    },
    {
      note: 'loaded confidential client',
      clientAuth: { method: 'none' } as const,
      client: { isConfidential: true, isFirstParty: false },
      expected: true,
    },
    {
      note: 'loaded first-party public client',
      clientAuth: { method: 'none' } as const,
      client: { isConfidential: false, isFirstParty: true },
      expected: true,
    },
    {
      note: 'missing public client metadata',
      clientAuth: { method: 'none' } as const,
      client: undefined,
      expected: false,
    },
    {
      note: 'missing confidential client metadata',
      clientAuth: {
        method: 'private_key_jwt',
        alg: 'ES256',
        kid: 'key-1',
        jkt: 'thumbprint',
        jti: 'assertion-1',
      } as const,
      client: undefined,
      expected: true,
    },
  ])('$note', ({ clientAuth, client, expected }) => {
    const tokenInfo = createTokenInfo({
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: REFRESH_TOKEN,
      clientAuth,
    })

    expect(usesExtendedOAuthSessionLifetime(tokenInfo, client)).toBe(expected)
  })
})

describe(TokenManager, () => {
  it('returns only tokens belonging to the requested account', async () => {
    const accountToken = createTokenInfo({
      expiresAt: new Date(NOW.getTime() - 1),
      currentRefreshToken: null,
    })
    const otherAccountToken = createTokenInfo({
      accountDid: OTHER_ACCOUNT_DID,
      expiresAt: new Date(NOW.getTime() + 1),
      currentRefreshToken: null,
    })
    const { manager, listAccountTokens } = createTokenManager([
      accountToken,
      otherAccountToken,
    ])

    await expect(manager.listAccountTokens(ACCOUNT_DID)).resolves.toEqual([
      accountToken,
    ])
    expect(listAccountTokens).toHaveBeenCalledOnce()
    expect(listAccountTokens).toHaveBeenCalledWith(ACCOUNT_DID)
  })
})
