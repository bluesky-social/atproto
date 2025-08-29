import type { Account } from '@atproto/oauth-provider-api'
import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import { Sub } from '../oidc/sub.js'
import { Code } from '../request/code.js'
import { RefreshToken } from './refresh-token.js'
import { TokenData } from './token-data.js'
import { TokenId } from './token-id.js'

// Export all types needed to implement the TokenStore interface
export * from './refresh-token.js'
export * from './token-data.js'
export * from './token-id.js'
export type { Account, Awaitable, Sub }

export type TokenInfo = {
  id: TokenId
  data: TokenData
  account: Account
  currentRefreshToken: null | RefreshToken
}

export type NewTokenData = {
  clientAuth: TokenData['clientAuth']
  expiresAt: TokenData['expiresAt']
  updatedAt: TokenData['updatedAt']
  scope: NonNullable<TokenData['scope']>
}

export type CreateTokenData = TokenData & {
  scope: NonNullable<TokenData['scope']>
}

/**
 * @param data historically, {@link TokenData.scope} was not present in
 * {@link TokenData}, causing it to be "nullable" when returned from
 * {@link TokenStore.readToken}. We use {@link CreateTokenData} here to allow
 * the store implementation to expect its presence.
 */
export interface TokenStore {
  createToken(
    tokenId: TokenId,
    data: CreateTokenData,
    refreshToken?: RefreshToken,
  ): Awaitable<void>

  readToken(tokenId: TokenId): Awaitable<null | TokenInfo>

  deleteToken(tokenId: TokenId): Awaitable<void>

  rotateToken(
    tokenId: TokenId,
    newTokenId: TokenId,
    newRefreshToken: RefreshToken,
    newData: NewTokenData,
  ): Awaitable<void>

  /**
   * Find a token by its refresh token. Note that previous refresh tokens
   * should also return the token. The data model is responsible for storing
   * old refresh tokens when a new one is issued.
   */
  findTokenByRefreshToken(
    refreshToken: RefreshToken,
  ): Awaitable<null | TokenInfo>

  findTokenByCode(code: Code): Awaitable<null | TokenInfo>

  listAccountTokens(sub: Sub): Awaitable<TokenInfo[]>
}

export const isTokenStore = buildInterfaceChecker<TokenStore>([
  'createToken',
  'readToken',
  'deleteToken',
  'rotateToken',
  'findTokenByRefreshToken',
  'findTokenByCode',
  'listAccountTokens',
])

export function asTokenStore<V extends Partial<TokenStore>>(
  implementation?: V,
): V & TokenStore {
  if (!implementation || !isTokenStore(implementation)) {
    throw new Error('Invalid TokenStore implementation')
  }
  return implementation
}
