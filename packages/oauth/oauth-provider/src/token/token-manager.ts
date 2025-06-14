import { SignedJwt, isSignedJwt } from '@atproto/jwk'
import type { Account } from '@atproto/oauth-provider-api'
import {
  OAuthAccessToken,
  OAuthAuthorizationRequestParameters,
  OAuthTokenResponse,
  OAuthTokenType,
} from '@atproto/oauth-types'
import { AccessTokenMode } from '../access-token/access-token-mode.js'
import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { TOKEN_MAX_AGE } from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { InvalidTokenError } from '../errors/invalid-token-error.js'
import { RequestMetadata } from '../lib/http/request.js'
import { dateToEpoch, dateToRelativeSeconds } from '../lib/util/date.js'
import { callAsync } from '../lib/util/function.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { DpopProof } from '../oauth-verifier.js'
import { Sub } from '../oidc/sub.js'
import { Code, isCode } from '../request/code.js'
import { SignedTokenPayload } from '../signer/signed-token-payload.js'
import { Signer } from '../signer/signer.js'
import {
  RefreshToken,
  generateRefreshToken,
  isRefreshToken,
} from './refresh-token.js'
import { TokenData } from './token-data.js'
import { TokenId, generateTokenId, isTokenId } from './token-id.js'
import { TokenInfo, TokenStore } from './token-store.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
  verifyTokenClaims,
} from './verify-token-claims.js'

export { AccessTokenMode, Signer }
export type { OAuthHooks, TokenStore, VerifyTokenClaimsResult }

export class TokenManager {
  constructor(
    protected readonly store: TokenStore,
    protected readonly signer: Signer,
    protected readonly hooks: OAuthHooks,
    protected readonly accessTokenMode: AccessTokenMode,
    protected readonly tokenMaxAge = TOKEN_MAX_AGE,
  ) {}

  protected createTokenExpiry(now = new Date()) {
    return new Date(now.getTime() + this.tokenMaxAge)
  }

  protected async buildAccessToken(
    tokenId: TokenId,
    account: Account,
    client: Client,
    parameters: OAuthAuthorizationRequestParameters,
    options: {
      now: Date
      expiresAt: Date
    },
  ): Promise<OAuthAccessToken> {
    return this.signer.createAccessToken({
      jti: tokenId,
      sub: account.sub,
      exp: dateToEpoch(options.expiresAt),
      iat: dateToEpoch(options.now),
      cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,

      ...(this.accessTokenMode === AccessTokenMode.stateless && {
        aud: account.aud,
        scope: parameters.scope,
        // https://datatracker.ietf.org/doc/html/rfc8693#section-4.3
        client_id: client.id,
      }),
    })
  }

  async createToken(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    account: Account,
    deviceId: null | DeviceId,
    parameters: OAuthAuthorizationRequestParameters,
    code: Code,
  ): Promise<OAuthTokenResponse> {
    await this.validateTokenParams(client, clientAuth, parameters)

    const tokenId = await generateTokenId()
    const refreshToken = client.metadata.grant_types.includes('refresh_token')
      ? await generateRefreshToken()
      : undefined

    const now = new Date()
    const expiresAt = this.createTokenExpiry(now)

    const tokenData: TokenData = {
      createdAt: now,
      updatedAt: now,
      expiresAt,
      clientId: client.id,
      clientAuth,
      deviceId,
      sub: account.sub,
      parameters,
      details: null,
      code,
    }

    const accessToken = await this.buildAccessToken(
      tokenId,
      account,
      client,
      parameters,
      { now, expiresAt },
    )

    const response = await this.buildTokenResponse(
      client,
      accessToken,
      refreshToken,
      expiresAt,
      parameters,
      account.sub,
    )

    await this.store.createToken(tokenId, tokenData, refreshToken)

    try {
      await callAsync(this.hooks.onTokenCreated, {
        client,
        clientAuth,
        clientMetadata,
        account,
        parameters,
      })

      return response
    } catch (err) {
      // If the hook fails, we delete the token to avoid leaving a dangling
      // token in the store.
      await this.deleteToken(tokenId)
      throw err
    }
  }

  protected async validateTokenParams(
    client: Client,
    clientAuth: ClientAuth,
    parameters: OAuthAuthorizationRequestParameters,
  ): Promise<void> {
    if (client.metadata.dpop_bound_access_tokens && !parameters.dpop_jkt) {
      throw new InvalidGrantError(
        `DPoP JKT is required for DPoP bound access tokens`,
      )
    }
  }

  protected buildTokenResponse(
    client: Client,
    accessToken: OAuthAccessToken,
    refreshToken: string | undefined,
    expiresAt: Date,
    parameters: OAuthAuthorizationRequestParameters,
    sub: Sub,
  ): OAuthTokenResponse {
    return {
      access_token: accessToken,
      token_type: parameters.dpop_jkt ? 'DPoP' : 'Bearer',
      refresh_token: refreshToken,
      scope: parameters.scope,

      // @NOTE using a getter so that the value gets computed when the JSON
      // response is generated, allowing to value to be as accurate as possible.
      get expires_in() {
        return dateToRelativeSeconds(expiresAt)
      },

      // ATPROTO extension: add the sub claim to the token response to allow
      // clients to resolve the PDS url (audience) using the did resolution
      // mechanism.
      sub,
    }
  }

  async rotateToken(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    tokenInfo: TokenInfo,
  ): Promise<OAuthTokenResponse> {
    const { account, data } = tokenInfo
    const { parameters } = data

    await this.validateTokenParams(client, clientAuth, parameters)

    const nextTokenId = await generateTokenId()
    const nextRefreshToken = await generateRefreshToken()

    const now = new Date()
    const expiresAt = this.createTokenExpiry(now)

    await this.store.rotateToken(tokenInfo.id, nextTokenId, nextRefreshToken, {
      updatedAt: now,
      expiresAt,
      // @NOTE Normally, the clientAuth not change over time. There are two
      // exceptions:
      // - Upgrade from a legacy representation of client authentication to
      //   a modern one.
      // - Allow clients to become "confidential" if they were previously
      //   "public"
      clientAuth,
    })

    const accessToken = await this.buildAccessToken(
      nextTokenId,
      account,
      client,
      parameters,
      { now, expiresAt },
    )

    const response = await this.buildTokenResponse(
      client,
      accessToken,
      nextRefreshToken,
      expiresAt,
      parameters,
      account.sub,
    )

    await callAsync(this.hooks.onTokenRefreshed, {
      client,
      clientAuth,
      clientMetadata,
      account,
      parameters,
    })

    return response
  }

  /**
   * @note The token validity is not guaranteed. The caller must ensure that the
   * token is valid before using the returned token info.
   */
  public async findToken(token: string): Promise<null | TokenInfo> {
    if (isTokenId(token)) {
      return this.getTokenInfo(token)
    } else if (isCode(token)) {
      return this.findByCode(token)
    } else if (isRefreshToken(token)) {
      return this.findByRefreshToken(token)
    } else if (isSignedJwt(token)) {
      return this.findByAccessToken(token)
    } else {
      throw new InvalidRequestError(`Invalid token`)
    }
  }

  public async findByAccessToken(token: SignedJwt): Promise<null | TokenInfo> {
    const { payload } = await this.signer.verifyAccessToken(token, {
      clockTolerance: Infinity,
    })

    const tokenInfo = await this.getTokenInfo(payload.jti)
    if (!tokenInfo) return null

    // Fool-proof: Invalid store implementation ?
    if (payload.sub !== tokenInfo.account.sub) {
      await this.deleteToken(tokenInfo.id)
      throw new Error(
        `Account sub (${tokenInfo.account.sub}) does not match token sub (${payload.sub})`,
      )
    }

    return tokenInfo
  }

  protected async findByRefreshToken(
    token: RefreshToken,
  ): Promise<null | TokenInfo> {
    return this.store.findTokenByRefreshToken(token)
  }

  public async consumeRefreshToken(token: RefreshToken): Promise<TokenInfo> {
    // @NOTE concurrent refreshes of the same refresh token could theoretically
    // lead to two new tokens (access & refresh) being created. This is deemed
    // acceptable for now (as the mechanism can only be used once since only one
    // of the two refresh token created will be valid, and any future refresh
    // attempts from outdated tokens will cause the entire session to be
    // invalidated). Ideally, the store should be able to handle this case by
    // atomically consuming the refresh token and returning the token info.

    // @TODO Add another store method that atomically consumes the refresh token
    // with a lock.
    const tokenInfo = await this.findByRefreshToken(token).catch((err) => {
      throw InvalidTokenError.from(err, `Invalid refresh token`)
    })

    if (!tokenInfo) {
      throw new InvalidGrantError(`Invalid refresh token`)
    }

    if (tokenInfo.currentRefreshToken !== token) {
      await this.deleteToken(tokenInfo.id)
      throw new InvalidGrantError(`Refresh token replayed`)
    }

    return tokenInfo
  }

  public async findByCode(code: Code): Promise<null | TokenInfo> {
    return this.store.findTokenByCode(code)
  }

  public async deleteToken(tokenId: TokenId): Promise<void> {
    return this.store.deleteToken(tokenId)
  }

  async getTokenInfo(tokenId: TokenId): Promise<null | TokenInfo> {
    return this.store.readToken(tokenId)
  }

  async verifyToken(
    token: OAuthAccessToken,
    tokenType: OAuthTokenType,
    tokenId: TokenId,
    dpopProof: null | DpopProof,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<VerifyTokenClaimsResult> {
    const tokenInfo = await this.getTokenInfo(tokenId).catch((err) => {
      throw InvalidTokenError.from(err, tokenType)
    })

    if (!tokenInfo) {
      throw new InvalidTokenError(tokenType, `Invalid token`)
    }

    if (isCurrentTokenExpired(tokenInfo)) {
      await this.deleteToken(tokenId)
      throw new InvalidTokenError(tokenType, `Token expired`)
    }

    const { account, data } = tokenInfo
    const { parameters } = data

    // Construct a list of claim, as if the token was a JWT.
    const tokenClaims: SignedTokenPayload = {
      iss: this.signer.issuer,
      jti: tokenId,
      sub: account.sub,
      exp: dateToEpoch(data.expiresAt),
      iat: dateToEpoch(data.updatedAt),
      cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,

      // These are not stored in the JWT access token in "light" access token
      // mode. See `buildAccessToken`.
      aud: account.aud,
      scope: parameters.scope,
      client_id: data.clientId,
    }

    return verifyTokenClaims(
      token,
      tokenId,
      tokenType,
      tokenClaims,
      dpopProof,
      verifyOptions,
    )
  }

  async listAccountTokens(sub: Sub): Promise<TokenInfo[]> {
    const results = await this.store.listAccountTokens(sub)
    return results
      .filter((tokenInfo) => tokenInfo.account.sub === sub) // Fool proof
      .filter((tokenInfo) => !isCurrentTokenExpired(tokenInfo))
  }
}

function isCurrentTokenExpired(tokenInfo: TokenInfo): boolean {
  return tokenInfo.data.expiresAt.getTime() < Date.now()
}
