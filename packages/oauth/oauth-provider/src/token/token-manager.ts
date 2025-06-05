import { createHash } from 'node:crypto'
import { SignedJwt, isSignedJwt } from '@atproto/jwk'
import type { Account } from '@atproto/oauth-provider-api'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAccessToken,
  OAuthAuthorizationCodeGrantTokenRequest,
  OAuthAuthorizationRequestParameters,
  OAuthClientCredentialsGrantTokenRequest,
  OAuthPasswordGrantTokenRequest,
  OAuthRefreshTokenGrantTokenRequest,
  OAuthTokenResponse,
  OAuthTokenType,
} from '@atproto/oauth-types'
import { AccessTokenMode } from '../access-token/access-token-mode.js'
import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import {
  AUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT,
  AUTHENTICATED_REFRESH_LIFETIME,
  TOKEN_MAX_AGE,
  UNAUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT,
  UNAUTHENTICATED_REFRESH_LIFETIME,
} from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
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
  refreshTokenSchema,
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

  async create(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    account: Account,
    deviceId: null | DeviceId,
    parameters: OAuthAuthorizationRequestParameters,
    input:
      | OAuthAuthorizationCodeGrantTokenRequest
      | OAuthClientCredentialsGrantTokenRequest
      | OAuthPasswordGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    // @NOTE the atproto specific DPoP requirement is enforced though the
    // "dpop_bound_access_tokens" metadata, which is enforced by the
    // ClientManager class.
    if (client.metadata.dpop_bound_access_tokens && !dpopProof) {
      throw new InvalidDpopProofError('DPoP proof required')
    }

    if (!parameters.dpop_jkt) {
      // Allow clients to bind their access tokens to a DPoP key during
      // token request if they didn't provide a "dpop_jkt" during the
      // authorization request.
      if (dpopProof) parameters = { ...parameters, dpop_jkt: dpopProof.jkt }
    } else if (!dpopProof) {
      throw new InvalidDpopProofError('DPoP proof required')
    } else if (parameters.dpop_jkt !== dpopProof.jkt) {
      throw new InvalidDpopKeyBindingError()
    }

    if (clientAuth.method === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
      // Clients **must not** use their private key to sign DPoP proofs.
      if (parameters.dpop_jkt && clientAuth.jkt === parameters.dpop_jkt) {
        throw new InvalidRequestError(
          'The DPoP proof must be signed with a different key than the client assertion',
        )
      }
    }

    if (!client.metadata.grant_types.includes(input.grant_type)) {
      throw new InvalidGrantError(
        `This client is not allowed to use the "${input.grant_type}" grant type`,
      )
    }

    let code: Code | null = null

    switch (input.grant_type) {
      case 'authorization_code': {
        if (!isCode(input.code)) {
          throw new InvalidGrantError('Invalid code')
        }

        // @NOTE not using `this.findByCode` because we want to delete the token
        // if it still exists (rather than throwing if the code is invalid).
        const tokenInfo = await this.store.findTokenByCode(input.code)
        if (tokenInfo) {
          await this.deleteToken(tokenInfo.id)
          throw new InvalidGrantError(`Code replayed`)
        }

        code = input.code

        if (parameters.redirect_uri !== input.redirect_uri) {
          throw new InvalidGrantError(
            'The redirect_uri parameter must match the one used in the authorization request',
          )
        }

        if (parameters.code_challenge) {
          if (!input.code_verifier) {
            throw new InvalidGrantError('code_verifier is required')
          }
          if (input.code_verifier.length < 43) {
            throw new InvalidGrantError('code_verifier too short')
          }
          switch (parameters.code_challenge_method ?? 'plain') {
            case 'plain': {
              if (parameters.code_challenge !== input.code_verifier) {
                throw new InvalidGrantError('Invalid code_verifier')
              }
              break
            }
            case 'S256': {
              const inputChallenge = Buffer.from(
                parameters.code_challenge,
                'base64',
              )
              const computedChallenge = createHash('sha256')
                .update(input.code_verifier)
                .digest()
              if (inputChallenge.compare(computedChallenge) !== 0) {
                throw new InvalidGrantError('Invalid code_verifier')
              }
              break
            }
            default: {
              // Should never happen (because request validation should catch this)
              throw new Error(`Unsupported code_challenge_method`)
            }
          }
        } else if (input.code_verifier !== undefined) {
          throw new InvalidRequestError(
            "code_challenge parameter wasn't provided",
          )
        }

        break
      }

      default: {
        // Other grants (e.g "password", "client_credentials") could be added
        // here in the future...
        throw new InvalidRequestError(
          `Unsupported grant type "${input.grant_type}"`,
        )
      }
    }

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

    await this.store.createToken(tokenId, tokenData, refreshToken)

    try {
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

      await callAsync(this.hooks.onTokenCreated, {
        client,
        clientAuth,
        clientMetadata,
        account,
        parameters,
      })

      return response
    } catch (err) {
      // Just in case the token could not be issued, we delete it from the store
      await this.deleteToken(tokenId)

      throw err
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

  public async validateAccess(
    client: Client,
    clientAuth: ClientAuth,
    tokenInfo: TokenInfo,
  ) {
    if (tokenInfo.data.clientId !== client.id) {
      throw new InvalidGrantError(`Token was not issued to this client`)
    }

    if (tokenInfo.data.clientAuth.method !== clientAuth.method) {
      throw new InvalidGrantError(`Client authentication method mismatch`)
    }

    if (!(await client.validateClientAuth(tokenInfo.data.clientAuth))) {
      throw new InvalidGrantError(`Client authentication mismatch`)
    }
  }

  public async validateRefresh(
    client: Client,
    clientAuth: ClientAuth,
    { data }: TokenInfo,
  ): Promise<void> {
    // @TODO This value should be computable even if we don't have the "client"
    // (because fetching client info could be flaky). Instead, all the info
    // needed should be stored in the token info.
    const allowLongerLifespan =
      client.info.isFirstParty || data.clientAuth.method !== 'none'

    const lifetime = allowLongerLifespan
      ? AUTHENTICATED_REFRESH_LIFETIME
      : UNAUTHENTICATED_REFRESH_LIFETIME

    if (data.createdAt.getTime() + lifetime < Date.now()) {
      throw new InvalidGrantError(`Refresh token expired`)
    }

    const inactivityTimeout = allowLongerLifespan
      ? AUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT
      : UNAUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT

    if (data.updatedAt.getTime() + inactivityTimeout < Date.now()) {
      throw new InvalidGrantError(`Refresh token exceeded inactivity timeout`)
    }
  }

  async refresh(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    input: OAuthRefreshTokenGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const refreshTokenParsed = refreshTokenSchema.safeParse(input.refresh_token)
    if (!refreshTokenParsed.success) {
      throw new InvalidRequestError('Invalid refresh token')
    }
    const refreshToken = refreshTokenParsed.data

    const tokenInfo = await this.findByRefreshToken(refreshToken).catch(
      (err) => {
        throw InvalidGrantError.from(
          err,
          err instanceof InvalidRequestError
            ? err.error_description
            : 'Invalid refresh token',
        )
      },
    )

    const { account, data } = tokenInfo
    const { parameters } = data

    try {
      await this.validateAccess(client, clientAuth, tokenInfo)
      await this.validateRefresh(client, clientAuth, tokenInfo)

      if (!client.metadata.grant_types.includes(input.grant_type)) {
        // In case the client metadata was updated after the token was issued
        throw new InvalidGrantError(
          `This client is not allowed to use the "${input.grant_type}" grant type`,
        )
      }

      if (parameters.dpop_jkt) {
        if (!dpopProof) {
          throw new InvalidDpopProofError('DPoP proof required')
        } else if (parameters.dpop_jkt !== dpopProof.jkt) {
          throw new InvalidDpopKeyBindingError()
        }
      }

      const nextTokenId = await generateTokenId()
      const nextRefreshToken = await generateRefreshToken()

      const now = new Date()
      const expiresAt = this.createTokenExpiry(now)

      await this.store.rotateToken(
        tokenInfo.id,
        nextTokenId,
        nextRefreshToken,
        {
          updatedAt: now,
          expiresAt,
          // When clients rotate their public keys, we store the key that was
          // used by the client to authenticate itself while requesting new
          // tokens. The validateAccess() method will ensure that the client
          // still advertises the key that was used to issue the previous
          // refresh token. If a client stops advertising a key, all tokens
          // bound to that key will no longer be be refreshable. This allows
          // clients to proactively invalidate tokens when a key is compromised.
          // Note that the original DPoP key cannot be rotated. This protects
          // users in case the ownership of the client id changes. In the latter
          // case, a malicious actor could still advertises the public keys of
          // the previous owner, but the new owner would not be able to present
          // a valid DPoP proof.
          clientAuth,
        },
      )

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
    } catch (err) {
      // Just in case the token could not be refreshed, we delete it from the store
      await this.deleteToken(tokenInfo.id)

      throw err
    }
  }

  /**
   * @note The token validity is not guaranteed. The caller must ensure that the
   * token is valid before using the returned token info.
   */
  public async findToken(token: string): Promise<TokenInfo> {
    if (isTokenId(token)) {
      return this.getTokenInfo(token)
    } else if (isCode(token)) {
      return this.findByCode(token)
    } else if (isRefreshToken(token)) {
      return this.findByRefreshToken(token)
    } else if (isSignedJwt(token)) {
      return this.findBySignedJwt(token)
    } else {
      throw new InvalidRequestError(`Invalid token`)
    }
  }

  public async findBySignedJwt(token: SignedJwt): Promise<TokenInfo> {
    const { payload } = await this.signer.verifyAccessToken(token, {
      clockTolerance: Infinity,
    })

    const tokenInfo = await this.getTokenInfo(payload.jti)

    // Fool-proof: Invalid store implementation ?
    if (payload.sub !== tokenInfo.account.sub) {
      await this.deleteToken(tokenInfo.id)
      throw new Error(
        `Account sub (${tokenInfo.account.sub}) does not match token sub (${payload.sub})`,
      )
    }

    return tokenInfo
  }

  public async findByRefreshToken(token: RefreshToken): Promise<TokenInfo> {
    const tokenInfo = await this.store.findTokenByRefreshToken(token)

    if (!tokenInfo) {
      throw new InvalidRequestError(`Invalid refresh token`)
    }

    if (tokenInfo.currentRefreshToken !== token) {
      await this.deleteToken(tokenInfo.id)

      throw new InvalidRequestError(`Refresh token replayed`)
    }

    return tokenInfo
  }

  public async findByCode(code: Code): Promise<TokenInfo> {
    const tokenInfo = await this.store.findTokenByCode(code)

    if (!tokenInfo) {
      throw new InvalidRequestError(`Invalid code`)
    }

    return tokenInfo
  }

  public async deleteToken(tokenId: TokenId): Promise<void> {
    return this.store.deleteToken(tokenId)
  }

  async getTokenInfo(tokenId: TokenId): Promise<TokenInfo> {
    const tokenInfo = await this.store.readToken(tokenId)

    if (!tokenInfo) {
      throw new InvalidRequestError(`Invalid token`)
    }

    return tokenInfo
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
