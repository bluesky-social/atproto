import {
  Handler,
  IncomingMessage,
  Middleware,
  Router,
  ServerResponse,
  acceptMiddleware,
  combine as combineMiddlewares,
  setupCsrfToken,
  staticJsonHandler,
  validateCsrfToken,
  validateFetchMode,
  validateReferer,
  validateRequestPayload,
  validateSameOrigin,
  writeJson,
} from '@atproto/http-util'
import { Jwks, Jwt, Keyset, jwtSchema } from '@atproto/jwk'
import {
  OAuthClientId,
  oauthClientIdSchema,
} from '@atproto/oauth-client-metadata'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'
import { JWTHeaderParameters, ResolvedKey } from 'jose'
import { z } from 'zod'

import { AccessTokenType } from './access-token/access-token-type.js'
import { AccessToken } from './access-token/access-token.js'
import { AccountManager } from './account/account-manager.js'
import {
  AccountStore,
  DeviceAccount,
  LoginCredentials,
  asAccountStore,
} from './account/account-store.js'
import { Account } from './account/account.js'
import { authorizeAssetsMiddleware } from './assets/assets-middleware.js'
import { ClientAuth, authJwkThumbprint } from './client/client-auth.js'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  ClientIdentification,
} from './client/client-credentials.js'
import { ClientManager } from './client/client-manager.js'
import { ClientStore, asClientStore } from './client/client-store.js'
import { AuthEndpoint, Client } from './client/client.js'
import { AUTH_MAX_AGE, TOKEN_MAX_AGE } from './constants.js'
import { DeviceId } from './device/device-id.js'
import { DeviceManager } from './device/device-manager.js'
import { DeviceStore, asDeviceStore } from './device/device-store.js'
import { AccessDeniedError } from './errors/access-denied-error.js'
import { AccountSelectionRequiredError } from './errors/account-selection-required-error.js'
import { ConsentRequiredError } from './errors/consent-required-error.js'
import { InvalidClientError } from './errors/invalid-client-error.js'
import { InvalidGrantError } from './errors/invalid-grant-error.js'
import { InvalidParametersError } from './errors/invalid-parameters-error.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { LoginRequiredError } from './errors/login-required-error.js'
import { UnauthorizedClientError } from './errors/unauthorized-client-error.js'
import { WWWAuthenticateError } from './errors/www-authenticate-error.js'
import { CustomMetadata, buildMetadata } from './metadata/build-metadata.js'
import { OAuthHooks } from './oauth-hooks.js'
import { OAuthVerifier, OAuthVerifierOptions } from './oauth-verifier.js'
import { Userinfo } from './oidc/userinfo.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from './output/build-error-payload.js'
import { Customization } from './output/customization.js'
import {
  AuthorizationResultAuthorize,
  sendAuthorizePage,
} from './output/send-authorize-page.js'
import {
  AuthorizationResultRedirect,
  sendAuthorizeRedirect,
} from './output/send-authorize-redirect.js'
import { sendErrorPage } from './output/send-error-page.js'
import {
  AuthorizationParameters,
  authorizationParametersSchema,
} from './parameters/authorization-parameters.js'
import { oidcPayload } from './parameters/oidc-payload.js'
import { ReplayStore, asReplayStore } from './replay/replay-store.js'
import { RequestManager } from './request/request-manager.js'
import { RequestStoreMemory } from './request/request-store-memory.js'
import { RequestStore, isRequestStore } from './request/request-store.js'
import { RequestUri, requestUriSchema } from './request/request-uri.js'
import {
  AuthorizationRequestJar,
  AuthorizationRequestQuery,
  PushedAuthorizationRequest,
  authorizationRequestQuerySchema,
  pushedAuthorizationRequestSchema,
} from './request/types.js'
import { isTokenId } from './token/token-id.js'
import { TokenManager } from './token/token-manager.js'
import { TokenResponse } from './token/token-response.js'
import { TokenInfo, TokenStore, asTokenStore } from './token/token-store.js'
import { TokenType } from './token/token-type.js'
import {
  CodeGrantRequest,
  Introspect,
  IntrospectionResponse,
  RefreshGrantRequest,
  Revoke,
  TokenRequest,
  introspectSchema,
  revokeSchema,
  tokenRequestSchema,
} from './token/types.js'
import { VerifyTokenClaimsOptions } from './token/verify-token-claims.js'
import { dateToEpoch, dateToRelativeSeconds } from './util/date.js'
import { Override } from './util/type.js'

export type OAuthProviderStore = Partial<
  ClientStore &
    AccountStore &
    DeviceStore &
    TokenStore &
    RequestStore &
    ReplayStore
>

export {
  Keyset,
  type CustomMetadata,
  type Customization,
  type Handler,
  type OAuthServerMetadata,
}
export type OAuthProviderOptions = Override<
  OAuthVerifierOptions & OAuthHooks,
  {
    /**
     * Maximum age a device/account session can be before requiring
     * re-authentication. This can be overridden on a authorization request basis
     * using the `max_age` parameter and on a client basis using the
     * `default_max_age` client metadata.
     */
    defaultMaxAge?: number

    /**
     * Maximum age access & id tokens can be before requiring a refresh.
     */
    tokenMaxAge?: number

    /**
     * Additional metadata to be included in the discovery document.
     */
    metadata?: CustomMetadata

    accountStore?: AccountStore
    deviceStore?: DeviceStore
    clientStore?: ClientStore
    replayStore?: ReplayStore
    requestStore?: RequestStore
    tokenStore?: TokenStore

    /**
     * This will be used as the default store for all the stores. If a store is
     * not provided, this store will be used instead. If the `store` does not
     * implement a specific store, a runtime error will be thrown. Make sure that
     * this store implements all the interfaces not provided in the other
     * `<name>Store` options.
     */
    store?: OAuthProviderStore
  }
>

export class OAuthProvider extends OAuthVerifier {
  public readonly metadata: OAuthServerMetadata

  public readonly defaultMaxAge: number

  public readonly accountManager: AccountManager
  public readonly deviceStore: DeviceStore
  public readonly clientManager: ClientManager
  public readonly requestManager: RequestManager
  public readonly tokenManager: TokenManager

  public constructor({
    defaultMaxAge = AUTH_MAX_AGE,
    tokenMaxAge = TOKEN_MAX_AGE,

    store,
    metadata,

    accountStore = asAccountStore(store),
    clientStore = asClientStore(store),
    replayStore = asReplayStore(store),
    requestStore = store && isRequestStore(store)
      ? store
      : new RequestStoreMemory(),
    deviceStore = asDeviceStore(store),
    tokenStore = asTokenStore(store),

    ...rest
  }: OAuthProviderOptions) {
    super({ replayStore, ...rest })

    this.defaultMaxAge = defaultMaxAge
    this.metadata = buildMetadata(this.issuer, this.keyset, metadata)

    this.deviceStore = deviceStore

    this.accountManager = new AccountManager(accountStore, rest)
    this.clientManager = new ClientManager(clientStore, this.keyset, rest)
    this.requestManager = new RequestManager(
      requestStore,
      this.signer,
      this.metadata,
      rest,
    )
    this.tokenManager = new TokenManager(
      tokenStore,
      this.signer,
      rest,
      this.accessTokenType,
      tokenMaxAge,
    )
  }

  get jwks(): Jwks {
    return this.keyset.publicJwks
  }

  protected loginRequired(
    client: Client,
    parameters: AuthorizationParameters,
    authenticatedAt: Date,
  ) {
    const authAge = Math.max(
      0, // Prevent negative values (fool proof)
      (Date.now() - authenticatedAt.getTime()) / 1e3,
    )
    const maxAge = Math.max(
      0, // Prevent negative values (fool proof)
      parameters.max_age ??
        client.metadata.default_max_age ??
        this.defaultMaxAge,
    )

    return Math.floor(authAge) > Math.floor(maxAge)
  }

  protected async authenticateClient(
    client: Client,
    endpoint: AuthEndpoint,
    credentials: ClientIdentification,
  ): Promise<ClientAuth> {
    const { clientAuth, nonce } = await client.verifyCredentials(
      credentials,
      endpoint,
      { audience: this.issuer },
    )

    if (nonce != null) {
      const unique = await this.replayManager.uniqueAuth(nonce, client.id)
      if (!unique) {
        throw new InvalidClientError(`${clientAuth.method} jti reused`)
      }
    }

    return clientAuth
  }

  protected async decodeJAR(
    client: Client,
    input: AuthorizationRequestJar,
  ): Promise<
    | {
        payload: AuthorizationParameters
        protectedHeader?: undefined
        key?: undefined
      }
    | {
        payload: AuthorizationParameters
        protectedHeader: JWTHeaderParameters & { kid: string }
        key: ResolvedKey['key']
      }
  > {
    const result = await client.decodeRequestObject(input.request)
    const payload = authorizationParametersSchema.parse(result.payload)

    if (!result.payload.jti) {
      throw new InvalidParametersError(
        payload,
        'Request object must contain a jti claim',
      )
    }

    if (!(await this.replayManager.uniqueJar(result.payload.jti, client.id))) {
      throw new InvalidParametersError(
        payload,
        'Request object jti is not unique',
      )
    }

    if ('protectedHeader' in result) {
      if (!result.protectedHeader.kid) {
        throw new InvalidParametersError(payload, 'Missing "kid" in header')
      }

      return {
        key: result.key,
        payload,
        protectedHeader: result.protectedHeader as JWTHeaderParameters & {
          kid: string
        },
      }
    }

    if ('header' in result) {
      return {
        payload,
      }
    }

    // Should never happen
    throw new Error('Invalid request object')
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9126}
   */
  protected async pushedAuthorizationRequest(
    input: PushedAuthorizationRequest,
    dpopJkt: null | string,
  ) {
    try {
      const client = await this.clientManager.getClient(input.client_id)
      const clientAuth = await this.authenticateClient(
        client,
        'pushed_authorization_request',
        input,
      )

      // TODO (?) should we allow using signed JAR for client authentication?
      const { payload: parameters } =
        'request' in input // Handle JAR
          ? await this.decodeJAR(client, input)
          : { payload: input }

      const { uri, expiresAt } =
        await this.requestManager.pushedAuthorizationRequest(
          client,
          clientAuth,
          parameters,
          dpopJkt,
        )

      return {
        request_uri: uri,
        expires_in: dateToRelativeSeconds(expiresAt),
      }
    } catch (err) {
      // https://datatracker.ietf.org/doc/html/rfc9126#section-2.3-1
      // > Since initial processing of the pushed authorization request does not
      // > involve resource owner interaction, error codes related to user
      // > interaction, such as consent_required defined by [OIDC], are never
      // > returned.
      if (err instanceof AccessDeniedError) {
        throw new InvalidRequestError(err.error_description, err)
      }
      throw err
    }
  }

  private async setupAuthorizationRequest(
    client: Client,
    deviceId: DeviceId,
    input: AuthorizationRequestQuery,
  ) {
    // Load PAR
    if ('request_uri' in input) {
      return this.requestManager.get(input.request_uri, client.id, deviceId)
    }

    // Handle JAR
    if ('request' in input) {
      const requestObject = await this.decodeJAR(client, input)

      if (requestObject.protectedHeader) {
        // Allow using signed JAR during "/authorize" as client authentication.
        // This allows clients to skip PAR to initiate trusted sessions.
        const clientAuth: ClientAuth = {
          method: CLIENT_ASSERTION_TYPE_JWT_BEARER,
          kid: requestObject.protectedHeader.kid,
          alg: requestObject.protectedHeader.alg,
          jkt: await authJwkThumbprint(requestObject.key),
        }

        return this.requestManager.authorizationRequest(
          client,
          clientAuth,
          requestObject.payload,
          deviceId,
        )
      }

      return this.requestManager.authorizationRequest(
        client,
        { method: 'none' },
        requestObject.payload,
        deviceId,
      )
    }

    return this.requestManager.authorizationRequest(
      client,
      { method: 'none' },
      input,
      deviceId,
    )
  }

  private async deleteRequest(
    uri: RequestUri,
    parameters: AuthorizationParameters,
  ) {
    try {
      await this.requestManager.delete(uri)
    } catch (err) {
      throw AccessDeniedError.from(parameters, err)
    }
  }

  protected async authorize(
    deviceId: DeviceId,
    input: AuthorizationRequestQuery,
  ): Promise<AuthorizationResultRedirect | AuthorizationResultAuthorize> {
    const { issuer } = this
    const client = await this.clientManager.getClient(input.client_id)

    try {
      const { uri, parameters, clientAuth } =
        await this.setupAuthorizationRequest(client, deviceId, input)

      try {
        const sessions = await this.getSessions(
          client,
          clientAuth,
          deviceId,
          parameters,
        )

        if (parameters.prompt === 'none') {
          const ssoSessions = sessions.filter((s) => s.matchesHint)
          if (ssoSessions.length > 1) {
            throw new AccountSelectionRequiredError(parameters)
          }
          if (ssoSessions.length < 1) {
            throw new LoginRequiredError(parameters)
          }

          const ssoSession = ssoSessions[0]!
          if (ssoSession.loginRequired) {
            throw new LoginRequiredError(parameters)
          }
          if (ssoSession.consentRequired) {
            throw new ConsentRequiredError(parameters)
          }

          const redirect = await this.requestManager.setAuthorized(
            client,
            uri,
            deviceId,
            ssoSession.account,
            ssoSession.authenticatedAt,
          )

          return { issuer, client, parameters, redirect }
        }

        // Automatic SSO when a did was provided
        if (parameters.prompt == null && parameters.login_hint != null) {
          const ssoSessions = sessions.filter((s) => s.matchesHint)
          if (ssoSessions.length === 1) {
            const ssoSession = ssoSessions[0]!
            if (!ssoSession.loginRequired && !ssoSession.consentRequired) {
              const redirect = await this.requestManager.setAuthorized(
                client,
                uri,
                deviceId,
                ssoSession.account,
                ssoSession.authenticatedAt,
              )

              return { issuer, client, parameters, redirect }
            }
          }
        }

        return { issuer, client, parameters, authorize: { uri, sessions } }
      } catch (err) {
        await this.deleteRequest(uri, parameters)

        // Transform into an AccessDeniedError to allow redirecting the user
        // to the client with the error details.
        throw AccessDeniedError.from(parameters, err)
      }
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return {
          issuer,
          client,
          parameters: err.parameters,
          redirect: err.toJSON(),
        }
      }

      throw err
    }
  }

  protected async getSessions(
    client: Client,
    clientAuth: ClientAuth,
    deviceId: DeviceId,
    parameters: AuthorizationParameters,
  ): Promise<
    {
      account: Account

      authenticatedAt: Date

      selected: boolean
      loginRequired: boolean
      consentRequired: boolean

      matchesHint: boolean
    }[]
  > {
    const sessions = await this.accountManager.listActiveSessions(deviceId)
    return sessions.map(({ account, data }) => ({
      account,

      authenticatedAt: data.authenticatedAt,

      selected:
        parameters.prompt !== 'select_account' &&
        parameters.login_hint === account.sub,
      loginRequired:
        parameters.prompt === 'login' ||
        this.loginRequired(client, parameters, data.authenticatedAt),
      consentRequired:
        parameters.prompt === 'consent' ||
        !data.authorizedClients.includes(client.id),
      matchesHint:
        parameters.login_hint === account.sub || parameters.login_hint == null,
    }))
  }

  protected async signIn(
    deviceId: DeviceId,
    credentials: LoginCredentials,
    remember: boolean,
  ): Promise<DeviceAccount> {
    return this.accountManager.signIn(deviceId, credentials, remember)
  }

  protected async acceptRequest(
    deviceId: DeviceId,
    uri: RequestUri,
    clientId: OAuthClientId,
    sub: string,
  ): Promise<AuthorizationResultRedirect> {
    const { issuer } = this
    const client = await this.clientManager.getClient(clientId)

    try {
      const { parameters } = await this.requestManager.get(
        uri,
        clientId,
        deviceId,
      )

      try {
        const { account, data } = await this.accountManager.getAuthenticated(
          deviceId,
          sub,
        )

        // The user is trying to authorize without a fresh login
        if (this.loginRequired(client, parameters, data.authenticatedAt)) {
          throw new LoginRequiredError(
            parameters,
            'Account authentication required.',
          )
        }

        const redirect = await this.requestManager.setAuthorized(
          client,
          uri,
          deviceId,
          account,
          data.authenticatedAt,
        )

        if (data.remembered && !data.authorizedClients.includes(clientId)) {
          await this.accountManager.setAuthorizedClients(
            deviceId,
            account.sub,
            [...data.authorizedClients, clientId],
          )
        }

        return { issuer, client, parameters, redirect }
      } catch (err) {
        await this.deleteRequest(uri, parameters)

        throw AccessDeniedError.from(parameters, err)
      }
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        const { parameters } = err
        return { issuer, client, parameters, redirect: err.toJSON() }
      }

      throw err
    }
  }

  protected async rejectRequest(
    deviceId: DeviceId,
    uri: RequestUri,
    clientId: OAuthClientId,
  ): Promise<AuthorizationResultRedirect> {
    try {
      const { parameters } = await this.requestManager.get(
        uri,
        clientId,
        deviceId,
      )

      await this.deleteRequest(uri, parameters)

      // Trigger redirect (see catch block)
      throw new AccessDeniedError(parameters, 'Access denied')
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return {
          issuer: this.issuer,
          client: await this.clientManager.getClient(clientId),
          parameters: err.parameters,
          redirect: err.toJSON(),
        }
      }

      throw err
    }
  }

  protected async token(
    input: TokenRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    const client = await this.clientManager.getClient(input.client_id)
    const clientAuth = await this.authenticateClient(client, 'token', input)

    if (!client.metadata.grant_types.includes(input.grant_type)) {
      throw new InvalidGrantError(
        `"${input.grant_type}" grant type is not allowed for this client`,
      )
    }

    if (input.grant_type === 'authorization_code') {
      return this.codeGrant(client, clientAuth, input, dpopJkt)
    }

    if (input.grant_type === 'refresh_token') {
      return this.refreshTokenGrant(client, clientAuth, input, dpopJkt)
    }

    throw new InvalidGrantError(
      // @ts-expect-error: fool proof
      `Grant type "${input.grant_type}" not supported`,
    )
  }

  protected async codeGrant(
    client: Client,
    clientAuth: ClientAuth,
    input: CodeGrantRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    try {
      const { sub, deviceId, parameters } = await this.requestManager.findCode(
        client,
        clientAuth,
        input.code,
      )

      const { account, data } = await this.accountManager.getAuthenticated(
        deviceId,
        sub,
      )

      return await this.tokenManager.create(
        client,
        clientAuth,
        deviceId,
        account,
        parameters,
        input,
        dpopJkt,
        data.authenticatedAt,
      )
    } catch (err) {
      // If a token is replayed, requestManager.findCode will throw. In that
      // case, we need to revoke any token that was issued for this code.
      await this.tokenManager.revoke(input.code)

      throw err
    }
  }

  async refreshTokenGrant(
    client: Client,
    clientAuth: ClientAuth,
    input: RefreshGrantRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    return this.tokenManager.refresh(client, clientAuth, input, dpopJkt)
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7009#section-2.1 rfc7009}
   */
  protected async revoke(input: Revoke) {
    await this.tokenManager.revoke(input.token)
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7662#section-2.1 rfc7662}
   */
  protected async introspect(
    input: Introspect,
  ): Promise<IntrospectionResponse> {
    const client = await this.clientManager.getClient(input.client_id)
    const clientAuth = await this.authenticateClient(
      client,
      'introspection',
      input,
    )

    // RFC7662 states the following:
    //
    // > To prevent token scanning attacks, the endpoint MUST also require some
    // > form of authorization to access this endpoint, such as client
    // > authentication as described in OAuth 2.0 [RFC6749] or a separate OAuth
    // > 2.0 access token such as the bearer token described in OAuth 2.0 Bearer
    // > Token Usage [RFC6750]. The methods of managing and validating these
    // > authentication credentials are out of scope of this specification.
    if (clientAuth.method === 'none') {
      throw new UnauthorizedClientError('Client authentication required')
    }

    const start = Date.now()
    try {
      const tokenInfo = await this.tokenManager.clientTokenInfo(
        client,
        clientAuth,
        input.token,
      )

      return {
        active: true,

        scope: tokenInfo.data.parameters.scope,
        client_id: tokenInfo.data.clientId,
        username: tokenInfo.account.preferred_username,
        token_type: tokenInfo.data.parameters.dpop_jkt ? 'DPoP' : 'Bearer',
        authorization_details: tokenInfo.data.details ?? undefined,

        aud: tokenInfo.account.aud,
        exp: dateToEpoch(tokenInfo.data.expiresAt),
        iat: dateToEpoch(tokenInfo.data.updatedAt),
        iss: this.signer.issuer,
        jti: tokenInfo.id,
        sub: tokenInfo.account.sub,
      }
    } catch (err) {
      // Prevent brute force & timing attack (only for inactive tokens)
      await new Promise((r) => setTimeout(r, 750 - (Date.now() - start)))

      return {
        active: false,
      }
    }
  }

  /**
   * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.3.2 Successful UserInfo Response}
   */
  protected async userinfo({ data, account }: TokenInfo): Promise<Userinfo> {
    return {
      ...oidcPayload(data.parameters, account),

      sub: account.sub,

      client_id: data.clientId,
      username: account.preferred_username,
    }
  }

  protected async signUserinfo(userinfo: Userinfo): Promise<Jwt> {
    const client = await this.clientManager.getClient(userinfo.client_id)
    return this.signer.sign(
      {
        alg: client.metadata.userinfo_signed_response_alg,
        typ: 'JWT',
      },
      userinfo,
    )
  }

  override async authenticateToken(
    tokenType: TokenType,
    token: AccessToken,
    dpopJkt: string | null,
    verifyOptions?: VerifyTokenClaimsOptions,
  ) {
    if (isTokenId(token)) {
      this.assertTokenTypeAllowed(tokenType, AccessTokenType.id)

      return this.tokenManager.authenticateTokenId(
        tokenType,
        token,
        dpopJkt,
        verifyOptions,
      )
    }

    return super.authenticateToken(tokenType, token, dpopJkt, verifyOptions)
  }

  /**
   * @returns An http request handler that can be used with node's http server
   * or as a middleware with express / connect.
   */
  public httpHandler<
    T = void,
    Req extends IncomingMessage = IncomingMessage,
    Res extends ServerResponse = ServerResponse,
  >({
    customization,
    onError = process.env['NODE_ENV'] === 'development'
      ? (req, res, err): void => console.error('OAuthProvider error:', err)
      : undefined,
  }: {
    customization?: Customization
    onError?: (req: Req, res: Res, err: unknown) => void
  }): Handler<T, Req, Res> {
    const deviceManager = new DeviceManager(this.deviceStore)

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this
    const issuerUrl = new URL(server.issuer)
    const issuerOrigin = issuerUrl.origin
    const router = new Router<T, Req, Res>(issuerUrl)

    // Utils

    const csrfCookie = (uri: RequestUri) => `csrf-${uri}`

    /**
     * Creates a middleware that will serve static JSON content.
     */
    const staticJson = (json: unknown): Middleware<void, Req, Res> =>
      combineMiddlewares([
        function (req, res, next) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'max-age=300')
          next()
        },
        staticJsonHandler(json),
      ])

    /**
     * Wrap an OAuth endpoint in a middleware that will set the appropriate
     * response headers and format the response as JSON.
     */
    const dynamicJson = <T, TReq extends Req, TRes extends Res, Json>(
      buildJson: (this: T, req: TReq, res: TRes) => Json | Promise<Json>,
      status?: number,
    ): Handler<T, TReq, TRes> =>
      async function (req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*')

        // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')

        // https://datatracker.ietf.org/doc/html/rfc9449#section-8.2
        const dpopNonce = server.nextDpopNonce()
        if (dpopNonce) {
          const name = 'DPoP-Nonce'
          res.setHeader(name, dpopNonce)
          res.appendHeader('Access-Control-Expose-Headers', name)
        }

        try {
          const result = await buildJson.call(this, req, res)
          if (result !== undefined) writeJson(res, result, status)
          else if (!res.headersSent) res.writeHead(status ?? 204).end()
        } catch (err) {
          if (!res.headersSent) {
            if (err instanceof WWWAuthenticateError) {
              const name = 'WWW-Authenticate'
              res.setHeader(name, err.wwwAuthenticateHeader)
              res.appendHeader('Access-Control-Expose-Headers', name)
            }

            writeJson(res, buildErrorPayload(err), buildErrorStatus(err))
          } else {
            res.destroy()
          }

          await onError?.(req, res, err)
        }
      }

    //- Public OAuth endpoints

    /*
     * Although OpenID compatibility is not required to implement the Atproto
     * OAuth2 specification, we do support OIDC discovery in this
     * implementation as we believe this may:
     * 1) Make the implementation of Atproto clients easier (since lots of
     *    libraries support OIDC discovery)
     * 2) Allow self hosted PDS' to not implement authentication themselves
     *    but rely on a trusted Atproto actor to act as their OIDC providers.
     *    By supporting OIDC in the current implementation, Bluesky's
     *    Authorization Server server can be used as an OIDC provider for
     *    these users.
     */
    router.get('/.well-known/openid-configuration', staticJson(server.metadata))

    router.get(
      '/.well-known/oauth-authorization-server',
      staticJson(server.metadata),
    )

    // CORS preflight
    router.options<{
      endpoint: 'jwks' | 'par' | 'token' | 'revoke' | 'introspect' | 'userinfo'
    }>(
      /^\/oauth\/(?<endpoint>jwks|par|token|revoke|introspect|userinfo)$/,
      function (req, res, _next) {
        res
          .writeHead(204, {
            'Access-Control-Allow-Origin': req.headers['origin'] || '*',
            'Access-Control-Allow-Methods':
              this.params.endpoint === 'jwks' ? 'GET' : 'POST',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,DPoP',
            'Access-Control-Max-Age': '86400', // 1 day
          })
          .end()
      },
    )

    router.get('/oauth/jwks', staticJson(server.jwks))

    router.post(
      '/oauth/par',
      dynamicJson(async function (req, _res) {
        const input = await validateRequestPayload(
          req,
          pushedAuthorizationRequestSchema,
        )

        const dpopJkt = await server.checkDpopProof(
          req.headers['dpop'],
          req.method!,
          this.url,
        )

        return server.pushedAuthorizationRequest(input, dpopJkt)
      }, 201),
    )

    // https://datatracker.ietf.org/doc/html/rfc9126#section-2.3
    router.addRoute('*', '/oauth/par', (req, res) => {
      res.writeHead(405).end()
    })

    router.post(
      '/oauth/token',
      dynamicJson(async function (req, _res) {
        const input = await validateRequestPayload(req, tokenRequestSchema)

        const dpopJkt = await server.checkDpopProof(
          req.headers['dpop'],
          req.method!,
          this.url,
        )

        return server.token(input, dpopJkt)
      }),
    )

    router.post(
      '/oauth/revoke',
      dynamicJson(async function (req, _res) {
        const input = await validateRequestPayload(req, revokeSchema)
        await server.revoke(input)
      }),
    )

    router.get(
      '/oauth/revoke',
      dynamicJson(async function (req, res) {
        validateFetchMode(req, res, ['navigate'])
        validateSameOrigin(req, res, issuerOrigin)

        const query = Object.fromEntries(this.url.searchParams)
        const input = await revokeSchema.parseAsync(query, { path: ['query'] })
        await server.revoke(input)

        // Same as POST + redirect to callback URL
        // todo: generate JSONP response (if "callback" is provided)

        throw new Error(
          'You are successfully logged out. Redirect not implemented',
        )
      }),
    )

    router.post(
      '/oauth/introspect',
      dynamicJson(async function (req, _res) {
        const input = await validateRequestPayload(req, introspectSchema)
        return server.introspect(input)
      }),
    )

    const userinfoBodySchema = z.object({
      access_token: jwtSchema.optional(),
    })

    router.addRoute(
      ['GET', 'POST'],
      '/oauth/userinfo',
      acceptMiddleware(
        async function (req, _res) {
          const body =
            req.method === 'POST'
              ? await validateRequestPayload(req, userinfoBodySchema)
              : null

          if (body?.access_token && req.headers['authorization']) {
            throw new InvalidRequestError(
              'access token must be provided in either the authorization header or the request body',
            )
          }

          const auth = await server.authenticateHttpRequest(
            req.method!,
            this.url,
            body?.access_token // Allow credentials to be parsed from body.
              ? {
                  authorization: `Bearer ${body.access_token}`,
                  dpop: undefined, // DPoP can only be used with headers
                }
              : req.headers,
            {
              // TODO? Add the URL as an audience of the token ?
              // audience: [this.url.href],
              scope: ['profile'],
            },
          )

          const tokenInfo: TokenInfo =
            'tokenInfo' in auth
              ? (auth.tokenInfo as TokenInfo)
              : await server.tokenManager.getTokenInfo(
                  auth.tokenType,
                  auth.tokenId,
                )

          return server.userinfo(tokenInfo)
        },
        {
          '': 'application/json',
          'application/json': dynamicJson(async function (_req, _res) {
            return this.data
          }),
          'application/jwt': dynamicJson(async function (_req, res) {
            const jwt = await server.signUserinfo(this.data)
            res.writeHead(200, { 'Content-Type': 'application/jwt' }).end(jwt)
            return undefined
          }),
        },
      ),
    )

    //- Private authorization endpoints

    router.use(authorizeAssetsMiddleware())

    router.get('/oauth/authorize', async function (req, res) {
      try {
        res.setHeader('Cache-Control', 'no-store')

        validateFetchMode(req, res, ['navigate'])
        validateSameOrigin(req, res, issuerOrigin)

        const query = Object.fromEntries(this.url.searchParams)
        const input = await authorizationRequestQuerySchema.parseAsync(query, {
          path: ['query'],
        })

        const { deviceId } = await deviceManager.load(req, res)
        const data = await server.authorize(deviceId, input)

        switch (true) {
          case 'redirect' in data: {
            return await sendAuthorizeRedirect(req, res, data)
          }
          case 'authorize' in data: {
            await setupCsrfToken(req, res, csrfCookie(data.authorize.uri))
            return await sendAuthorizePage(req, res, data, customization)
          }
          default: {
            // Should never happen
            throw new Error('Unexpected authorization result')
          }
        }
      } catch (err) {
        await onError?.(req, res, err)

        if (!res.headersSent) {
          await sendErrorPage(req, res, err, customization)
        }
      }
    })

    const signInPayloadSchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      client_id: oauthClientIdSchema,
      credentials: z.object({
        username: z.string(),
        password: z.string(),
        remember: z.boolean().optional().default(false),
      }),
    })

    router.post('/oauth/authorize/sign-in', async function (req, res) {
      validateFetchMode(req, res, ['same-origin'])
      validateSameOrigin(req, res, issuerOrigin)

      const input = await validateRequestPayload(req, signInPayloadSchema)

      validateReferer(req, res, {
        origin: issuerOrigin,
        pathname: '/oauth/authorize',
      })
      validateCsrfToken(
        req,
        res,
        input.csrf_token,
        csrfCookie(input.request_uri),
      )

      const { deviceId } = await deviceManager.load(req, res)

      const { account, data } = await server.signIn(
        deviceId,
        input.credentials,
        input.credentials.remember,
      )

      // Prevent fixation attacks
      await deviceManager.rotate(req, res, deviceId)

      return writeJson(res, {
        account,
        consentRequired: !data.authorizedClients.includes(input.client_id),
      })
    })

    const acceptQuerySchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      client_id: oauthClientIdSchema,
      account_sub: z.string(),
    })

    router.get('/oauth/authorize/accept', async function (req, res) {
      try {
        res.setHeader('Cache-Control', 'no-store')

        validateFetchMode(req, res, ['navigate'])
        validateSameOrigin(req, res, issuerOrigin)

        const query = Object.fromEntries(this.url.searchParams)
        const input = await acceptQuerySchema.parseAsync(query, {
          path: ['query'],
        })

        validateReferer(req, res, {
          origin: issuerOrigin,
          pathname: '/oauth/authorize',
          searchParams: [
            ['request_uri', input.request_uri],
            ['client_id', input.client_id],
          ],
        })
        validateCsrfToken(
          req,
          res,
          input.csrf_token,
          csrfCookie(input.request_uri),
          true,
        )

        const { deviceId } = await deviceManager.load(req, res)

        const data = await server.acceptRequest(
          deviceId,
          input.request_uri,
          input.client_id,
          input.account_sub,
        )

        return await sendAuthorizeRedirect(req, res, data)
      } catch (err) {
        await onError?.(req, res, err)

        if (!res.headersSent) {
          await sendErrorPage(req, res, err, customization)
        }
      }
    })

    const rejectQuerySchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      client_id: oauthClientIdSchema,
    })

    router.get('/oauth/authorize/reject', async function (req, res) {
      try {
        res.setHeader('Cache-Control', 'no-store')

        validateFetchMode(req, res, ['navigate'])
        validateSameOrigin(req, res, issuerOrigin)

        const query = Object.fromEntries(this.url.searchParams)
        const input = await rejectQuerySchema.parseAsync(query, {
          path: ['query'],
        })

        validateReferer(req, res, {
          origin: issuerOrigin,
          pathname: '/oauth/authorize',
          searchParams: [
            ['request_uri', input.request_uri],
            ['client_id', input.client_id],
          ],
        })
        validateCsrfToken(
          req,
          res,
          input.csrf_token,
          csrfCookie(input.request_uri),
          true,
        )

        const { deviceId } = await deviceManager.load(req, res)

        const data = await server.rejectRequest(
          deviceId,
          input.request_uri,
          input.client_id,
        )

        return await sendAuthorizeRedirect(req, res, data)
      } catch (err) {
        await onError?.(req, res, err)

        if (!res.headersSent) {
          await sendErrorPage(req, res, err, customization)
        }
      }
    })

    return router.handler
  }
}
