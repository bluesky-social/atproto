import { isSignedJwt } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAccessToken,
  OAuthAuthorizationRequestParameters,
  OAuthAuthorizationCodeGrantTokenRequest,
  OAuthClientCredentialsGrantTokenRequest,
  OAuthPasswordGrantTokenRequest,
  OAuthRefreshTokenGrantTokenRequest,
  OAuthTokenResponse,
  OAuthTokenType,
} from '@atproto/oauth-types'
import { createHash } from 'node:crypto'

import { AccessTokenType } from '../access-token/access-token-type.js'
import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
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
import { dateToEpoch, dateToRelativeSeconds } from '../lib/util/date.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { Code, isCode } from '../request/code.js'
import { Signer } from '../signer/signer.js'
import {
  generateRefreshToken,
  isRefreshToken,
  refreshTokenSchema,
} from './refresh-token.js'
import { TokenClaims } from './token-claims.js'
import { TokenData } from './token-data.js'
import {
  TokenId,
  generateTokenId,
  isTokenId,
  tokenIdSchema,
} from './token-id.js'
import { TokenInfo, TokenStore } from './token-store.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
  verifyTokenClaims,
} from './verify-token-claims.js'

export type AuthenticateTokenIdResult = VerifyTokenClaimsResult & {
  tokenInfo: TokenInfo
}

export class TokenManager {
  constructor(
    protected readonly store: TokenStore,
    protected readonly signer: Signer,
    protected readonly hooks: OAuthHooks,
    protected readonly accessTokenType: AccessTokenType,
    protected readonly tokenMaxAge = TOKEN_MAX_AGE,
  ) {}

  protected createTokenExpiry(now = new Date()) {
    return new Date(now.getTime() + this.tokenMaxAge)
  }

  protected useJwtAccessToken(account: Account) {
    if (this.accessTokenType === AccessTokenType.auto) {
      return this.signer.issuer !== account.aud
    }

    return this.accessTokenType === AccessTokenType.jwt
  }

  async create(
    client: Client,
    clientAuth: ClientAuth,
    account: Account,
    device: null | { id: DeviceId; info: DeviceAccountInfo },
    parameters: OAuthAuthorizationRequestParameters,
    input:
      | OAuthAuthorizationCodeGrantTokenRequest
      | OAuthClientCredentialsGrantTokenRequest
      | OAuthPasswordGrantTokenRequest,
    dpopJkt: null | string,
  ): Promise<OAuthTokenResponse> {
    // @NOTE the atproto specific DPoP requirement is enforced though the
    // "dpop_bound_access_tokens" metadata, which is enforced by the
    // ClientManager class.
    if (client.metadata.dpop_bound_access_tokens && !dpopJkt) {
      throw new InvalidDpopProofError('DPoP proof required')
    }

    if (!parameters.dpop_jkt) {
      // Allow clients to bind their access tokens to a DPoP key during
      // token request if they didn't provide a "dpop_jkt" during the
      // authorization request.
      if (dpopJkt) parameters = { ...parameters, dpop_jkt: dpopJkt }
    } else if (parameters.dpop_jkt !== dpopJkt) {
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

        const tokenInfo = await this.store.findTokenByCode(input.code)
        if (tokenInfo) {
          await this.store.deleteToken(tokenInfo.id)
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

        if (!device) {
          // Fool-proofing (authorization_code grant should always have a device)
          throw new InvalidRequestError('consent was not given for this device')
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

    const authorizationDetails = await this.hooks.onAuthorizationDetails?.call(
      null,
      { client, parameters, account },
    )

    const tokenData: TokenData = {
      createdAt: now,
      updatedAt: now,
      expiresAt,
      clientId: client.id,
      clientAuth,
      deviceId: device?.id ?? null,
      sub: account.sub,
      parameters,
      details: authorizationDetails ?? null,
      code,
    }

    await this.store.createToken(tokenId, tokenData, refreshToken)

    try {
      const accessToken: OAuthAccessToken = !this.useJwtAccessToken(account)
        ? tokenId
        : await this.signer.accessToken(client, parameters, {
            // We don't specify the alg here. We suppose the Resource server will be
            // able to verify the token using any alg.
            aud: account.aud,
            sub: account.sub,
            alg: undefined,
            exp: expiresAt,
            iat: now,
            jti: tokenId,
            cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,
            authorization_details: authorizationDetails,
          })

      return this.buildTokenResponse(
        client,
        accessToken,
        refreshToken,
        expiresAt,
        parameters,
        account,
        authorizationDetails,
      )
    } catch (err) {
      // Just in case the token could not be issued, we delete it from the store
      await this.store.deleteToken(tokenId)

      throw err
    }
  }

  protected async buildTokenResponse(
    client: Client,
    accessToken: OAuthAccessToken,
    refreshToken: string | undefined,
    expiresAt: Date,
    parameters: OAuthAuthorizationRequestParameters,
    account: Account,
    authorizationDetails: null | any,
  ): Promise<OAuthTokenResponse> {
    const tokenResponse: OAuthTokenResponse = {
      access_token: accessToken,
      token_type: parameters.dpop_jkt ? 'DPoP' : 'Bearer',
      refresh_token: refreshToken,
      scope: parameters.scope,
      authorization_details: authorizationDetails,
      get expires_in() {
        return dateToRelativeSeconds(expiresAt)
      },

      // ATPROTO extension: add the sub claim to the token response to allow
      // clients to resolve the PDS url (audience) using the did resolution
      // mechanism.
      sub: account.sub,
    }

    return tokenResponse
  }

  protected async validateAccess(
    client: Client,
    clientAuth: ClientAuth,
    tokenInfo: TokenInfo,
  ) {
    if (tokenInfo.data.clientId !== client.id) {
      throw new InvalidGrantError(`Token was not issued to this client`)
    }

    if (tokenInfo.info?.authorizedClients.includes(client.id) === false) {
      throw new InvalidGrantError(`Client no longer trusted by user`)
    }

    if (tokenInfo.data.clientAuth.method !== clientAuth.method) {
      throw new InvalidGrantError(`Client authentication method mismatch`)
    }

    if (!(await client.validateClientAuth(tokenInfo.data.clientAuth))) {
      throw new InvalidGrantError(`Client authentication mismatch`)
    }
  }

  async refresh(
    client: Client,
    clientAuth: ClientAuth,
    input: OAuthRefreshTokenGrantTokenRequest,
    dpopJkt: null | string,
  ): Promise<OAuthTokenResponse> {
    const refreshTokenParsed = refreshTokenSchema.safeParse(input.refresh_token)
    if (!refreshTokenParsed.success) {
      throw new InvalidRequestError('Invalid refresh token')
    }
    const refreshToken = refreshTokenParsed.data

    const tokenInfo = await this.store.findTokenByRefreshToken(refreshToken)
    if (!tokenInfo?.currentRefreshToken) {
      throw new InvalidGrantError(`Invalid refresh token`)
    }

    const { account, data } = tokenInfo
    const { parameters } = data

    try {
      if (tokenInfo.currentRefreshToken !== refreshToken) {
        throw new InvalidGrantError(`refresh token replayed`)
      }

      await this.validateAccess(client, clientAuth, tokenInfo)

      if (input.grant_type !== 'refresh_token') {
        // Fool-proofing (should never happen)
        throw new InvalidGrantError(`Invalid grant type`)
      }

      if (!client.metadata.grant_types.includes(input.grant_type)) {
        // In case the client metadata was updated after the token was issued
        throw new InvalidGrantError(
          `This client is not allowed to use the "${input.grant_type}" grant type`,
        )
      }

      if (parameters.dpop_jkt) {
        if (!dpopJkt) {
          throw new InvalidDpopProofError('DPoP proof required')
        } else if (parameters.dpop_jkt !== dpopJkt) {
          throw new InvalidDpopKeyBindingError()
        }
      }

      const lastActivity = data.updatedAt
      const inactivityTimeout =
        clientAuth.method === 'none' && !client.info.isFirstParty
          ? UNAUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT
          : AUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT
      if (lastActivity.getTime() + inactivityTimeout < Date.now()) {
        throw new InvalidGrantError(`Refresh token exceeded inactivity timeout`)
      }

      const lifetime =
        clientAuth.method === 'none' && !client.info.isFirstParty
          ? UNAUTHENTICATED_REFRESH_LIFETIME
          : AUTHENTICATED_REFRESH_LIFETIME
      if (data.createdAt.getTime() + lifetime < Date.now()) {
        throw new InvalidGrantError(`Refresh token expired`)
      }

      const authorization_details =
        await this.hooks.onAuthorizationDetails?.call(null, {
          client,
          parameters,
          account,
        })

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

      const accessToken: OAuthAccessToken = !this.useJwtAccessToken(account)
        ? nextTokenId
        : await this.signer.accessToken(client, parameters, {
            // We don't specify the alg here. We suppose the Resource server will be
            // able to verify the token using any alg.
            aud: account.aud,
            sub: account.sub,
            alg: undefined,
            exp: expiresAt,
            iat: now,
            jti: nextTokenId,
            cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,
            authorization_details,
          })

      return this.buildTokenResponse(
        client,
        accessToken,
        nextRefreshToken,
        expiresAt,
        parameters,
        account,
        authorization_details,
      )
    } catch (err) {
      if (err instanceof InvalidRequestError) {
        // Consider the refresh token might be compromised if sanity checks
        // failed.
        await this.store.deleteToken(tokenInfo.id)
      }
      throw err
    }
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7009#section-2.2 | RFC7009 Section 2.2}
   */
  async revoke(token: string): Promise<void> {
    switch (true) {
      case isTokenId(token): {
        await this.store.deleteToken(token)
        return
      }

      case isSignedJwt(token): {
        const { payload } = await this.signer.verify(token, {
          clockTolerance: Infinity,
        })
        const tokenId = tokenIdSchema.parse(payload.jti)
        await this.store.deleteToken(tokenId)
        return
      }

      case isRefreshToken(token): {
        const tokenInfo = await this.store.findTokenByRefreshToken(token)
        if (tokenInfo) await this.store.deleteToken(tokenInfo.id)
        return
      }

      case isCode(token): {
        const tokenInfo = await this.store.findTokenByCode(token)
        if (tokenInfo) await this.store.deleteToken(tokenInfo.id)
        return
      }

      default:
        // No error should be returned if the token is not valid
        return
    }
  }

  /**
   * Allows an (authenticated) client to obtain information about a token.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7662 RFC7662}
   */
  async clientTokenInfo(
    client: Client,
    clientAuth: ClientAuth,
    token: string,
  ): Promise<TokenInfo> {
    const tokenInfo = await this.findTokenInfo(token)
    if (!tokenInfo) {
      throw new InvalidGrantError(`Invalid token`)
    }

    try {
      await this.validateAccess(client, clientAuth, tokenInfo)
    } catch (err) {
      await this.store.deleteToken(tokenInfo.id)
      throw err
    }

    if (tokenInfo.data.expiresAt.getTime() < Date.now()) {
      throw new InvalidGrantError(`Token expired`)
    }

    return tokenInfo
  }

  protected async findTokenInfo(token: string): Promise<TokenInfo | null> {
    switch (true) {
      case isTokenId(token):
        return this.store.readToken(token)

      case isSignedJwt(token): {
        const { payload } = await this.signer
          .verifyAccessToken(token)
          .catch((_) => ({ payload: null }))
        if (!payload) return null

        const tokenInfo = await this.store.readToken(payload.jti)
        if (!tokenInfo) return null

        // Audience changed (e.g. user was moved to another resource server)
        if (payload.aud !== tokenInfo.account.aud) {
          return null
        }

        // Invalid store implementation ?
        if (payload.sub !== tokenInfo.account.sub) {
          throw new Error(
            `Account sub (${tokenInfo.account.sub}) does not match token sub (${payload.sub})`,
          )
        }

        return tokenInfo
      }

      case isRefreshToken(token): {
        const tokenInfo = await this.store.findTokenByRefreshToken(token)
        if (!tokenInfo?.currentRefreshToken) return null
        if (tokenInfo.currentRefreshToken !== token) return null
        return tokenInfo
      }

      default:
        // Should never happen
        return null
    }
  }

  async getTokenInfo(tokenType: OAuthTokenType, tokenId: TokenId) {
    const tokenInfo = await this.store.readToken(tokenId)

    if (!tokenInfo) {
      throw new InvalidTokenError(tokenType, `Invalid token`)
    }

    if (!(tokenInfo.data.expiresAt.getTime() > Date.now())) {
      throw new InvalidTokenError(tokenType, `Token expired`)
    }

    return tokenInfo
  }

  async authenticateTokenId(
    tokenType: OAuthTokenType,
    token: TokenId,
    dpopJkt: string | null,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<AuthenticateTokenIdResult> {
    const tokenInfo = await this.getTokenInfo(tokenType, token)
    const { parameters } = tokenInfo.data

    // Construct a list of claim, as if the token was a JWT.
    const claims: TokenClaims = {
      aud: tokenInfo.account.aud,
      sub: tokenInfo.account.sub,
      exp: dateToEpoch(tokenInfo.data.expiresAt),
      iat: dateToEpoch(tokenInfo.data.updatedAt),
      scope: tokenInfo.data.parameters.scope,
      client_id: tokenInfo.data.clientId,
      cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,
    }

    const result = verifyTokenClaims(
      token,
      token,
      tokenType,
      dpopJkt,
      claims,
      verifyOptions,
    )

    return { ...result, tokenInfo }
  }
}
