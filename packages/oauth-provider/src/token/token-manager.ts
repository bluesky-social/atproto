import { createHash } from 'node:crypto'

import { isJwt } from '@atproto/jwk'

import { AccessTokenType } from '../access-token/access-token-type.js'
import { AccessToken } from '../access-token/access-token.js'
import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import {
  AUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT,
  TOKEN_MAX_AGE,
  TOTAL_REFRESH_LIFETIME,
  UNAUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT,
} from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { InvalidTokenError } from '../errors/invalid-token-error.js'
import { UnauthorizedDpopError } from '../errors/unauthorized-dpop-error.js'
import { UnauthorizedClientError } from '../errors/unauthorized-client-error.js'
import { AuthorizationDetails } from '../parameters/authorization-details.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { isCode } from '../request/code.js'
import { Signer } from '../signer/signer.js'
import { Awaitable } from '../util/awaitable.js'
import { dateToEpoch, dateToRelativeSeconds } from '../util/date.js'
import { matchRedirectUri } from '../util/redirect-uri.js'
import {
  RefreshToken,
  generateRefreshToken,
  isRefreshToken,
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
import { TokenType } from './token-type.js'
import {
  CodeGrantRequest,
  PasswordGrantRequest,
  RefreshGrantRequest,
} from './types.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
  verifyTokenClaims,
} from './verify-token-claims.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1 | RFC 6749 (OAuth2), Section 5.1}
 */
export type TokenResponse = {
  id_token?: string
  access_token?: AccessToken
  token_type?: TokenType
  expires_in?: number
  refresh_token?: RefreshToken
  scope?: string
  authorization_details?: AuthorizationDetails

  // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
  // > The client MUST ignore unrecognized value names in the response.
  [k: string]: unknown
}

export type AuthenticateTokenIdResult = VerifyTokenClaimsResult & {
  tokenInfo: TokenInfo
}

/**
 * Allows enriching the authorization details with additional information
 * before the tokens are issued.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396 | RFC 9396}
 */
export type AuthorizationDetailsHook = (
  this: null,
  data: {
    client: Client
    parameters: AuthorizationParameters
    account: Account
  },
) => Awaitable<undefined | AuthorizationDetails>

export type TokenResponseHook = (
  this: null,
  tokenResponse: TokenResponse,
  data: {
    client: Client
    parameters: AuthorizationParameters
    account: Account
  },
) => Awaitable<void>

export class TokenManager {
  constructor(
    protected readonly store: TokenStore,
    protected readonly signer: Signer,
    protected readonly hooks: {
      onAuthorizationDetails?: AuthorizationDetailsHook
      onTokenResponse?: TokenResponseHook
    },
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
    parameters: AuthorizationParameters,
    input: CodeGrantRequest | PasswordGrantRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    if (client.metadata.dpop_bound_access_tokens && !dpopJkt) {
      throw new UnauthorizedDpopError()
    }

    if (!parameters.dpop_jkt) {
      if (dpopJkt) parameters = { ...parameters, dpop_jkt: dpopJkt }
    } else if (!dpopJkt) {
      throw new UnauthorizedDpopError()
    } else if (parameters.dpop_jkt !== dpopJkt) {
      throw new InvalidDpopKeyBindingError()
    }

    if (
      clientAuth.method ===
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    ) {
      if (parameters.dpop_jkt && clientAuth.jkt === parameters.dpop_jkt) {
        throw new InvalidRequestError(
          'The DPoP proof must be signed with a different key than the client assertion',
        )
      }
    }

    if (!client.metadata.grant_types.includes(input.grant_type)) {
      throw new InvalidRequestError(
        `This client is not allowed to use the "${input.grant_type}" grant type`,
      )
    }

    switch (input.grant_type) {
      case 'authorization_code':
        if (!parameters.code_challenge || !parameters.code_challenge_method) {
          throw new InvalidRequestError('PKCE is required')
        }

        if (!parameters.redirect_uri) {
          const redirect_uri = client.metadata.redirect_uris.find((uri) =>
            matchRedirectUri(uri, input.redirect_uri),
          )
          if (redirect_uri) {
            parameters = { ...parameters, redirect_uri }
          } else {
            throw new InvalidRequestError(`Invalid redirect_uri`)
          }
        } else if (parameters.redirect_uri !== input.redirect_uri) {
          throw new InvalidRequestError(
            'This code was issued for another redirect_uri',
          )
        }

        break
      case 'password':
        break
      default:
        // @ts-expect-error: fool proofing
        throw new Error(`Unsupported grant type "${input.grant_type}"`)
    }

    if (parameters.code_challenge) {
      if (!('code_verifier' in input) || !input.code_verifier) {
        throw new InvalidRequestError('code_verifier is required')
      }
      switch (parameters.code_challenge_method) {
        case undefined: // Default is "plain" (per spec)
        case 'plain': {
          if (parameters.code_challenge !== input.code_verifier) {
            throw new InvalidRequestError('Invalid code_verifier')
          }
          break
        }
        case 'S256': {
          // Because the code_challenge is base64url-encoded, we will decode
          // it in order to compare based on bytes.
          const inputChallenge = Buffer.from(
            parameters.code_challenge,
            'base64',
          )
          const computedChallenge = createHash('sha256')
            .update(input.code_verifier)
            .digest()
          if (inputChallenge.compare(computedChallenge) !== 0) {
            throw new InvalidRequestError('Invalid code_verifier')
          }
          break
        }
        default: {
          throw new InvalidRequestError(
            `Unsupported code_challenge_method ${parameters.code_challenge_method}`,
          )
        }
      }
    }

    const code = 'code' in input ? input.code : undefined
    if (code) {
      const tokenInfo = await this.store.findTokenByCode(code)
      if (tokenInfo) {
        await this.store.deleteToken(tokenInfo.id)
        throw new AccessDeniedError(`Code replayed`)
      }
    }

    const tokenId = await generateTokenId()
    const scopes = parameters.scope?.split(' ')
    const refreshToken = scopes?.includes('offline_access')
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
      code: code ?? null,
    }

    await this.store.createToken(tokenId, tokenData, refreshToken)

    const accessToken: AccessToken = !this.useJwtAccessToken(account)
      ? tokenId
      : await this.signer.accessToken(client, parameters, account, {
          // We don't specify the alg here. We suppose the Resource server will be
          // able to verify the token using any alg.
          alg: undefined,
          exp: expiresAt,
          iat: now,
          jti: tokenId,
          cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,
          authorization_details: authorizationDetails,
        })

    const responseTypes = parameters.response_type.split(' ')
    const idToken = responseTypes.includes('id_token')
      ? await this.signer.idToken(client, parameters, account, {
          exp: expiresAt,
          iat: now,
          // If there is no deviceInfo, we are in a "password_grant" context
          auth_time: device?.info.authenticatedAt || new Date(),
          access_token: accessToken,
          code,
        })
      : undefined

    const tokenResponse: TokenResponse = {
      access_token: accessToken,
      token_type: parameters.dpop_jkt ? 'DPoP' : 'Bearer',
      refresh_token: refreshToken,
      id_token: idToken,
      scope: parameters.scope,
      authorization_details: authorizationDetails,
      get expires_in() {
        return dateToRelativeSeconds(expiresAt)
      },
    }

    await this.hooks.onTokenResponse?.call(null, tokenResponse, {
      client,
      parameters,
      account,
    })

    return tokenResponse
  }

  protected async validateAccess(
    client: Client,
    clientAuth: ClientAuth,
    tokenInfo: TokenInfo,
  ) {
    if (tokenInfo.data.clientId !== client.id) {
      throw new AccessDeniedError(`Token was not issued to this client`)
    }

    if (tokenInfo.info?.authorizedClients.includes(client.id) === false) {
      throw new AccessDeniedError(`Client no longer trusted by user`)
    }

    if (tokenInfo.data.clientAuth.method !== clientAuth.method) {
      throw new AccessDeniedError(`Client authentication method mismatch`)
    }

    if (!(await client.validateClientAuth(tokenInfo.data.clientAuth))) {
      throw new AccessDeniedError(`Client authentication mismatch`)
    }
  }

  async refresh(
    client: Client,
    clientAuth: ClientAuth,
    input: RefreshGrantRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    const tokenInfo = await this.store.findTokenByRefreshToken(
      input.refresh_token,
    )
    if (!tokenInfo?.currentRefreshToken) {
      throw new AccessDeniedError(`Invalid refresh token`)
    }

    const { account, info, data } = tokenInfo
    const { parameters } = data

    try {
      if (tokenInfo.currentRefreshToken !== input.refresh_token) {
        throw new AccessDeniedError(`refresh token replayed`)
      }

      await this.validateAccess(client, clientAuth, tokenInfo)

      if (parameters.dpop_jkt) {
        if (!dpopJkt) {
          throw new UnauthorizedDpopError()
        } else if (parameters.dpop_jkt !== dpopJkt) {
          throw new InvalidDpopKeyBindingError()
        }
      }

      const lastActivity = data.updatedAt
      const inactivityTimeout =
        clientAuth.method === 'none'
          ? UNAUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT
          : AUTHENTICATED_REFRESH_INACTIVITY_TIMEOUT
      if (lastActivity.getTime() + inactivityTimeout < Date.now()) {
        throw new AccessDeniedError(`Refresh token exceeded inactivity timeout`)
      }

      if (data.createdAt.getTime() + TOTAL_REFRESH_LIFETIME < Date.now()) {
        throw new AccessDeniedError(`Refresh token expired`)
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

      const accessToken: AccessToken = !this.useJwtAccessToken(account)
        ? nextTokenId
        : await this.signer.accessToken(client, parameters, account, {
            // We don't specify the alg here. We suppose the Resource server will be
            // able to verify the token using any alg.
            alg: undefined,
            exp: expiresAt,
            iat: now,
            jti: nextTokenId,
            cnf: parameters.dpop_jkt ? { jkt: parameters.dpop_jkt } : undefined,
            authorization_details,
          })

      const responseTypes = parameters.response_type.split(' ')
      const idToken = responseTypes.includes('id_token')
        ? await this.signer.idToken(client, parameters, account, {
            exp: expiresAt,
            iat: now,
            auth_time: info?.authenticatedAt,
            access_token: accessToken,
          })
        : undefined

      const tokenResponse: TokenResponse = {
        id_token: idToken,
        access_token: accessToken,
        token_type: parameters.dpop_jkt ? 'DPoP' : 'Bearer',
        refresh_token: nextRefreshToken,
        scope: parameters.scope,
        authorization_details,
        get expires_in() {
          return dateToRelativeSeconds(expiresAt)
        },
      }

      await this.hooks.onTokenResponse?.call(null, tokenResponse, {
        client,
        parameters,
        account,
      })

      return tokenResponse
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        // Consider the refresh token might be compromised
        await this.store.deleteToken(tokenInfo.id)
      }
      throw err
    }
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7009#section-2.2 rfc7009}
   */
  async revoke(token: string): Promise<void> {
    switch (true) {
      case isTokenId(token): {
        await this.store.deleteToken(token)
        return
      }

      case isJwt(token): {
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
      throw new UnauthorizedClientError(`Invalid token`)
    }

    try {
      await this.validateAccess(client, clientAuth, tokenInfo)
    } catch (err) {
      await this.store.deleteToken(tokenInfo.id)
      throw err
    }

    if (tokenInfo.data.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedClientError(`Token expired`)
    }

    return tokenInfo
  }

  protected async findTokenInfo(token: string): Promise<TokenInfo | null> {
    switch (true) {
      case isTokenId(token):
        return this.store.readToken(token)

      case isJwt(token): {
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

  async getTokenInfo(tokenType: TokenType, tokenId: TokenId) {
    const tokenInfo = await this.store.readToken(tokenId)

    if (!tokenInfo) {
      throw new InvalidTokenError(`Invalid token`, { [tokenType]: {} })
    }

    if (!(tokenInfo.data.expiresAt.getTime() > Date.now())) {
      throw new InvalidTokenError(`Token expired`, { [tokenType]: {} })
    }

    return tokenInfo
  }

  async authenticateTokenId(
    tokenType: TokenType,
    token: TokenId,
    dpopJkt: string | null,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<AuthenticateTokenIdResult> {
    const tokenInfo = await this.getTokenInfo(tokenType, token)
    const { parameters } = tokenInfo.data

    const claims: TokenClaims = {
      aud: tokenInfo.account.aud,
      sub: tokenInfo.account.sub,
      exp: dateToEpoch(tokenInfo.data.expiresAt),
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
