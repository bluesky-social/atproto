import { Account } from '../account/account.js'
import { Code } from '../request/code.js'
import { Awaitable } from '../util/awaitable.js'
import { RefreshToken } from './refresh-token.js'
import { TokenData } from './token-data.js'
import { TokenId } from './token-id.js'

// Export all types needed to implement the TokenStore interface
export type * from './token-data.js'
export type { Awaitable, RefreshToken, TokenData, TokenId }

export type TokenInfo = {
  id: TokenId
  data: TokenData
  account: Account
  currentRefreshToken: null | RefreshToken
}

export type NewTokenData = Pick<
  TokenData,
  'clientAuth' | 'expiresAt' | 'updatedAt'
>

export interface TokenStore {
  createToken(
    tokenId: TokenId,
    data: TokenData,
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
   * should also return the token. The data model is reponsible for storing
   * old refresh tokens when a new one is issued.
   */
  findTokenByRefreshToken(
    refreshToken: RefreshToken,
  ): Awaitable<null | TokenInfo>

  findTokenByCode(code: Code): Awaitable<null | TokenInfo>
}

export function isTokenStore(
  implementation: Record<string, unknown> & Partial<TokenStore>,
): implementation is Record<string, unknown> & TokenStore {
  return (
    typeof implementation.createToken === 'function' &&
    typeof implementation.readToken === 'function' &&
    typeof implementation.rotateToken === 'function' &&
    typeof implementation.deleteToken === 'function' &&
    typeof implementation.findTokenByCode === 'function' &&
    typeof implementation.findTokenByRefreshToken === 'function'
  )
}

export function asTokenStore(
  implementation?: Record<string, unknown> & Partial<TokenStore>,
): TokenStore {
  if (!implementation || !isTokenStore(implementation)) {
    throw new Error('Invalid TokenStore implementation')
  }
  return implementation
}
