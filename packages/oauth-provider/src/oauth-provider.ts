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
import { JWTHeaderParameters, ResolvedKey, decodeJwt } from 'jose'
import { z } from 'zod'

import { AccessTokenType } from './access-token/access-token-type.js'
import { AccessToken } from './access-token/access-token.js'
import { AccountManager } from './account/account-manager.js'
import {
  AccountInfo,
  AccountStore,
  DeviceAccountInfo,
  LoginCredentials,
  asAccountStore,
} from './account/account-store.js'
import { Account } from './account/account.js'
import { ClientAuth, authJwkThumbprint } from './client/client-auth.js'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  ClientIdentification,
} from './client/client-credentials.js'
import { ClientId, clientIdSchema } from './client/client-id.js'
import { ClientDataHook, ClientManager } from './client/client-manager.js'
import { ClientStore, asClientStore } from './client/client-store.js'
import { Client } from './client/client.js'
import { AUTH_MAX_AGE, TOKEN_MAX_AGE } from './constants.js'
import { DeviceId } from './device/device-id.js'
import { AccessDeniedError } from './errors/access-denied-error.js'
import { AccountSelectionRequiredError } from './errors/account-selection-required-error.js'
import { ConsentRequiredError } from './errors/consent-required-error.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { LoginRequiredError } from './errors/login-required-error.js'
import { OAuthError } from './errors/oauth-error.js'
import { UnauthorizedClientError } from './errors/unauthorized-client-error.js'
import { WWWAuthenticateError } from './errors/www-authenticate-error.js'
import {
  CustomMetadata,
  Metadata,
  buildMetadata,
} from './metadata/build-metadata.js'
import { OAuthVerifier, OAuthVerifierOptions } from './oauth-verifier.js'
import { Userinfo } from './oidc/userinfo.js'
import { authorizeAssetsMiddleware } from './assets/assets-middleware.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from './output/build-error-payload.js'
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
import {
  AuthorizationRequestHook,
  RequestManager,
} from './request/request-manager.js'
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
import { SessionManager } from './session/session-manager.js'
import { SessionStore, asSessionStore } from './session/session-store.js'
import { isTokenId } from './token/token-id.js'
import {
  AuthorizationDetailsHook,
  TokenManager,
  TokenResponse,
  TokenResponseHook,
} from './token/token-manager.js'
import { TokenInfo, TokenStore, asTokenStore } from './token/token-store.js'
import { TokenType } from './token/token-type.js'
import {
  CodeGrantRequest,
  Introspect,
  IntrospectionResponse,
  PasswordGrantRequest,
  RefreshGrantRequest,
  Revoke,
  TokenRequest,
  introspectSchema,
  revokeSchema,
  tokenRequestSchema,
} from './token/types.js'
import { VerifyTokenClaimsOptions } from './token/verify-token-claims.js'
import { dateToEpoch, dateToRelativeSeconds } from './util/date.js'
import { Branding } from './output/branding.js'

export type OAuthProviderStore = Partial<
  ClientStore &
    AccountStore &
    SessionStore &
    TokenStore &
    RequestStore &
    ReplayStore
>

export { Keyset, type CustomMetadata, type Handler }
export type OAuthProviderOptions = OAuthVerifierOptions & {
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

  onAuthorizationRequest?: AuthorizationRequestHook
  onAuthorizationDetails?: AuthorizationDetailsHook
  onClientData?: ClientDataHook
  onTokenResponse?: TokenResponseHook

  accountStore?: AccountStore
  clientStore?: ClientStore
  replayStore?: ReplayStore
  requestStore?: RequestStore
  sessionStore?: SessionStore
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

export class OAuthProvider extends OAuthVerifier {
  public readonly metadata: Metadata

  public readonly defaultMaxAge: number

  public readonly sessionStore: SessionStore

  public readonly accountManager: AccountManager
  public readonly clientManager: ClientManager
  public readonly requestManager: RequestManager
  public readonly tokenManager: TokenManager

  public constructor({
    defaultMaxAge = AUTH_MAX_AGE,
    tokenMaxAge = TOKEN_MAX_AGE,

    store,
    metadata,

    onAuthorizationRequest,
    onAuthorizationDetails,
    onClientData,
    onTokenResponse,

    accountStore = asAccountStore(store),
    clientStore = asClientStore(store),
    replayStore = asReplayStore(store),
    requestStore = store && isRequestStore(store)
      ? store
      : new RequestStoreMemory(),
    sessionStore = asSessionStore(store),
    tokenStore = asTokenStore(store),

    ...superOptions
  }: OAuthProviderOptions) {
    super({ replayStore, ...superOptions })

    const hooks = {
      onAuthorizationRequest,
      onAuthorizationDetails,
      onClientData,
      onTokenResponse,
    }

    this.defaultMaxAge = defaultMaxAge
    this.metadata = buildMetadata(this.issuer, this.keyset, metadata)

    this.sessionStore = sessionStore

    this.accountManager = new AccountManager(accountStore)
    this.clientManager = new ClientManager(clientStore, this.keyset, hooks)
    this.requestManager = new RequestManager(requestStore, this.signer, hooks)
    this.tokenManager = new TokenManager(
      tokenStore,
      this.signer,
      hooks,
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
    info: DeviceAccountInfo,
  ) {
    const authAge = Math.max(
      0, // Prevent negative values (fool proof)
      (Date.now() - info.authenticatedAt.getTime()) / 1e3,
    )
    const maxAge = Math.max(
      0, // Prevent negative values (fool proof)
      parameters.max_age ??
        client.metadata.default_max_age ??
        this.defaultMaxAge,
    )

    return Math.floor(authAge) > Math.floor(maxAge)
  }

  protected consentRequired(
    client: Client,
    clientAuth: ClientAuth,
    parameters: AuthorizationParameters,
    info: DeviceAccountInfo,
  ) {
    // Every client must have been granted consent at least once
    if (!info.authorizedClients.includes(client.id)) return true

    // Allow listed clients can skip consent event without credentials
    // TODO: make this configurable
    if (client.id === 'bsky.app') return false

    // Unauthenticated clients must always go through consent
    if (clientAuth.method === 'none') return true

    return false
  }

  protected async authenticateClient(
    client: Client,
    endpoint: 'token' | 'introspection' | 'revocation',
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
        throw new InvalidRequestError(`${clientAuth.method} jti reused`)
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

    if (!result.payload.jti) {
      throw new InvalidRequestError('Request object must contain a jti claim')
    }

    if (!(await this.replayManager.uniqueJar(result.payload.jti, client.id))) {
      throw new InvalidRequestError('Request object jti is not unique')
    }

    const payload = authorizationParametersSchema.parse(result.payload)

    if ('protectedHeader' in result) {
      if (!result.protectedHeader.kid) {
        throw new InvalidRequestError('Missing "kid" in header')
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
    const client = await this.clientManager.getClient(input.client_id)
    const clientAuth = await this.authenticateClient(client, 'token', input)

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
          const ssoSessions = sessions.filter((s) => s.ssoAllowed)
          if (ssoSessions.length > 1) throw new AccountSelectionRequiredError()
          if (ssoSessions.length < 1) throw new LoginRequiredError()

          const ssoSession = ssoSessions[0]!
          if (ssoSession.consentRequired) throw new ConsentRequiredError()
          if (ssoSession.loginRequired) throw new LoginRequiredError()

          const redirect = await this.requestManager.setAuthorized(
            client,
            uri,
            deviceId,
            ssoSession.account,
            ssoSession.info,
          )

          return { issuer, client, parameters, redirect }
        }

        return { issuer, client, parameters, authorize: { uri, sessions } }
      } catch (err) {
        await this.requestManager.delete(uri)

        if (err instanceof OAuthError) {
          return { issuer, client, parameters, redirect: err.toJSON() }
        }

        throw err
      }
    } catch (err) {
      if (err instanceof OAuthError && 'redirect_uri' in input) {
        return { issuer, client, parameters: input, redirect: err.toJSON() }
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
      info: DeviceAccountInfo

      ssoAllowed: boolean
      initiallySelected: boolean
      loginRequired: boolean
      consentRequired: boolean
    }[]
  > {
    const accounts = await this.accountManager.list(deviceId)

    const idTokenSub =
      parameters.id_token_hint != null
        ? // token already validated by RequestManager.validate()
          decodeJwt(parameters.id_token_hint).sub || null
        : null

    const hasHint = Boolean(parameters.id_token_hint || parameters.login_hint)
    const hintSub = // Only take the hint into account if they match each other
      parameters.login_hint && idTokenSub
        ? parameters.login_hint === idTokenSub
          ? idTokenSub
          : null
        : parameters.login_hint || idTokenSub || null

    return accounts.map(({ account, info }) => {
      const consentRequired = this.consentRequired(
        client,
        clientAuth,
        parameters,
        info,
      )
      const loginRequired = this.loginRequired(client, parameters, info)
      const matchesHint = hintSub != null && hintSub === account.sub

      return {
        account,
        info,

        ssoAllowed: parameters.prompt === 'none' && (!hasHint || matchesHint),
        loginRequired: parameters.prompt === 'login' || loginRequired,
        consentRequired: parameters.prompt === 'consent' || consentRequired,
        initiallySelected:
          parameters.prompt !== 'select_account' && matchesHint,
      }
    })
  }

  protected async login(
    deviceId: DeviceId,
    uri: RequestUri,
    credentials: LoginCredentials,
  ): Promise<AccountInfo> {
    const account = await this.accountManager.login(credentials, deviceId)
    return this.accountManager.get(deviceId, account.sub)
  }

  protected async acceptRequest(
    deviceId: DeviceId,
    uri: RequestUri,
    clientId: ClientId,
    sub: string,
  ): Promise<AuthorizationResultRedirect> {
    const { account, info } = await this.accountManager.get(deviceId, sub)

    const { issuer } = this
    const { parameters } = await this.requestManager.get(
      uri,
      clientId,
      deviceId,
    )

    const client = await this.clientManager.getClient(clientId)

    // The user is trying to authorize without a fresh login
    if (this.loginRequired(client, parameters, info)) {
      throw new LoginRequiredError('Account authentication required.')
    }

    try {
      const redirect = await this.requestManager.setAuthorized(
        client,
        uri,
        deviceId,
        account,
        info,
      )

      try {
        await this.accountManager.addAuthorizedClient(
          deviceId,
          account.sub,
          client.id,
        )
      } catch (err) {
        await this.requestManager.delete(uri)
        throw err
      }

      return { issuer, client, parameters, redirect }
    } catch (err) {
      if (err instanceof OAuthError) {
        const redirect = buildErrorPayload(err)
        return { issuer, client, parameters, redirect }
      }

      throw err
    }
  }

  protected async rejectRequest(
    deviceId: DeviceId,
    uri: RequestUri,
    clientId: ClientId,
  ): Promise<AuthorizationResultRedirect> {
    const { parameters } = await this.requestManager.get(
      uri,
      clientId,
      deviceId,
    )

    await this.requestManager.delete(uri)

    return {
      issuer: this.issuer,
      client: await this.clientManager.getClient(clientId),
      parameters,
      redirect: {
        error: 'access_denied',
        error_description: 'Access denied',
      },
    }
  }

  protected async token(
    input: TokenRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    const client = await this.clientManager.getClient(input.client_id)
    const clientAuth = await this.authenticateClient(client, 'token', input)

    if (!client.metadata.grant_types.includes(input.grant_type)) {
      throw new InvalidRequestError(
        `"${input.grant_type}" grant type is not allowed for this client`,
      )
    }

    if (input.grant_type === 'authorization_code') {
      return this.codeGrant(client, clientAuth, input, dpopJkt)
    }

    if (input.grant_type === 'refresh_token') {
      return this.refreshTokenGrant(client, clientAuth, input, dpopJkt)
    }

    if (input.grant_type === 'password') {
      // @ts-expect-error: THIS REQUIRES RATE LIMITING BEFORE IT CAN BE ENABLED
      if (!(this.allow_password_grant !== true)) {
        throw new InvalidRequestError('Password grant not allowed')
      }

      return this.passwordGrant(client, clientAuth, input, dpopJkt)
    }

    throw new InvalidRequestError(
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

      const { account, info } = await this.accountManager.get(deviceId, sub)

      // User revoked consent while client was asking for a token
      if (!info.authorizedClients.includes(client.id)) {
        throw new AccessDeniedError('Client not trusted anymore')
      }

      return await this.tokenManager.create(
        client,
        clientAuth,
        account,
        { id: deviceId, info },
        parameters,
        input,
        dpopJkt,
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

  async passwordGrant(
    client: Client,
    clientAuth: ClientAuth,
    input: PasswordGrantRequest,
    dpopJkt: null | string,
  ): Promise<TokenResponse> {
    const parameters = await this.requestManager.validate(
      client,
      clientAuth,
      {
        scope: input.scope,
        response_type: input.scope?.includes('openid')
          ? 'id_token token'
          : 'token',
      },
      dpopJkt,
      false,
    )

    const account = await this.accountManager.login(input, null)

    return this.tokenManager.create(
      client,
      clientAuth,
      account,
      null,
      parameters,
      input,
      dpopJkt,
    )
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
    branding,
    onError = process.env['NODE_ENV'] === 'development'
      ? (req, res, err): void => console.error('OAuthProvider error:', err)
      : undefined,
  }: {
    branding?: Branding
    onError?: (req: Req, res: Res, err: unknown) => void
  }): Handler<T, Req, Res> {
    const sessionManager = new SessionManager(this.sessionStore)

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

        const { deviceId } = await sessionManager.load(req, res)
        const data = await server.authorize(deviceId, input)

        switch (true) {
          case 'redirect' in data: {
            return await sendAuthorizeRedirect(req, res, data)
          }
          case 'authorize' in data: {
            await setupCsrfToken(req, res, csrfCookie(data.authorize.uri))
            return await sendAuthorizePage(req, res, data, branding)
          }
          default: {
            // Should never happen
            throw new Error('Unexpected authorization result')
          }
        }
      } catch (err) {
        await onError?.(req, res, err)

        if (!res.headersSent) {
          await sendErrorPage(req, res, err, branding)
        }
      }
    })

    const loginPayloadSchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      // client_id: clientIdSchema,
      credentials: z.object({
        username: z.string(),
        password: z.string(),
        remember: z.boolean().optional().default(false),
      }),
    })

    router.post('/oauth/authorize/sign-in', async function (req, res) {
      validateFetchMode(req, res, ['same-origin'])
      validateSameOrigin(req, res, issuerOrigin)

      const input = await validateRequestPayload(req, loginPayloadSchema)

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

      const { deviceId } = await sessionManager.load(req, res)

      const { account, info } = await server.login(
        deviceId,
        input.request_uri,
        input.credentials,
      )

      // Prevent fixation attacks
      await sessionManager.rotate(req, res, deviceId)

      return writeJson(res, { account, info })
    })

    const acceptQuerySchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      client_id: clientIdSchema,
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

        const { deviceId } = await sessionManager.load(req, res)

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
          await sendErrorPage(req, res, err, branding)
        }
      }
    })

    const rejectQuerySchema = z.object({
      csrf_token: z.string(),
      request_uri: requestUriSchema,
      client_id: clientIdSchema,
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

        const { deviceId } = await sessionManager.load(req, res)

        const data = await server.rejectRequest(
          deviceId,
          input.request_uri,
          input.client_id,
        )

        return await sendAuthorizeRedirect(req, res, data)
      } catch (err) {
        await onError?.(req, res, err)

        if (!res.headersSent) {
          await sendErrorPage(req, res, err, branding)
        }
      }
    })

    return router.handler
  }
}
