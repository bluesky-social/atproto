import type { Redis, RedisOptions } from 'ioredis'
import { Jwks, Keyset } from '@atproto/jwk'
import type { Account } from '@atproto/oauth-provider-api'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAccessToken,
  OAuthAuthorizationCodeGrantTokenRequest,
  OAuthAuthorizationRequestJar,
  OAuthAuthorizationRequestPar,
  OAuthAuthorizationRequestParameters,
  OAuthAuthorizationRequestQuery,
  OAuthAuthorizationServerMetadata,
  OAuthClientCredentials,
  OAuthClientCredentialsNone,
  OAuthClientMetadata,
  OAuthParResponse,
  OAuthRefreshTokenGrantTokenRequest,
  OAuthTokenIdentification,
  OAuthTokenRequest,
  OAuthTokenResponse,
  OAuthTokenType,
  atprotoLoopbackClientMetadata,
  oauthAuthorizationRequestParametersSchema,
} from '@atproto/oauth-types'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { SimpleStore } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { AccessTokenMode } from './access-token/access-token-mode.js'
import { AccountManager } from './account/account-manager.js'
import {
  AccountStore,
  AuthorizedClientData,
  DeviceAccount,
  asAccountStore,
} from './account/account-store.js'
import { ClientAuth, authJwkThumbprint } from './client/client-auth.js'
import { ClientId } from './client/client-id.js'
import {
  ClientManager,
  LoopbackMetadataGetter,
} from './client/client-manager.js'
import { ClientStore, ifClientStore } from './client/client-store.js'
import { Client } from './client/client.js'
import { AUTHENTICATION_MAX_AGE, TOKEN_MAX_AGE } from './constants.js'
import { Branding, BrandingInput } from './customization/branding.js'
import {
  Customization,
  CustomizationInput,
  customizationSchema,
} from './customization/customization.js'
import { DeviceId } from './device/device-id.js'
import {
  DeviceManager,
  DeviceManagerOptions,
  deviceManagerOptionsSchema,
} from './device/device-manager.js'
import { DeviceStore, asDeviceStore } from './device/device-store.js'
import { AccessDeniedError } from './errors/access-denied-error.js'
import { AccountSelectionRequiredError } from './errors/account-selection-required-error.js'
import { ConsentRequiredError } from './errors/consent-required-error.js'
import { InvalidGrantError } from './errors/invalid-grant-error.js'
import { InvalidParametersError } from './errors/invalid-parameters-error.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { LoginRequiredError } from './errors/login-required-error.js'
import { HcaptchaConfig } from './lib/hcaptcha.js'
import { RequestMetadata } from './lib/http/request.js'
import { dateToRelativeSeconds } from './lib/util/date.js'
import { LocalizedString, MultiLangString } from './lib/util/locale.js'
import { extractZodErrorMessage } from './lib/util/zod-error.js'
import { CustomMetadata, buildMetadata } from './metadata/build-metadata.js'
import { OAuthHooks } from './oauth-hooks.js'
import {
  DpopProof,
  OAuthVerifier,
  OAuthVerifierOptions,
} from './oauth-verifier.js'
import { ReplayStore, ifReplayStore } from './replay/replay-store.js'
import { codeSchema } from './request/code.js'
import { RequestInfo } from './request/request-info.js'
import { RequestManager } from './request/request-manager.js'
import { RequestStoreMemory } from './request/request-store-memory.js'
import { RequestStoreRedis } from './request/request-store-redis.js'
import { RequestStore, ifRequestStore } from './request/request-store.js'
import { requestUriSchema } from './request/request-uri.js'
import { AuthorizationRedirectParameters } from './result/authorization-redirect-parameters.js'
import { AuthorizationResultAuthorizePage } from './result/authorization-result-authorize-page.js'
import { AuthorizationResultRedirect } from './result/authorization-result-redirect.js'
import { ErrorHandler } from './router/error-handler.js'
import { TokenManager } from './token/token-manager.js'
import { TokenStore, asTokenStore } from './token/token-store.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
} from './token/verify-token-claims.js'

export { AccessTokenMode, Keyset }
export type {
  AuthorizationRedirectParameters,
  AuthorizationResultAuthorizePage as AuthorizationResultAuthorize,
  AuthorizationResultRedirect,
  Branding,
  BrandingInput,
  CustomMetadata,
  Customization,
  CustomizationInput,
  ErrorHandler,
  HcaptchaConfig,
  LocalizedString,
  MultiLangString,
  OAuthAuthorizationServerMetadata,
}

type OAuthProviderConfig = {
  /**
   * Maximum age a device/account session can be before requiring
   * re-authentication.
   */
  authenticationMaxAge?: number

  /**
   * Maximum age an ephemeral session (one where "remember me" was not
   * checked) can be before requiring re-authentication.
   */

  /**
   * Maximum age access & id tokens can be before requiring a refresh.
   */
  tokenMaxAge?: number

  /**
   * If set to {@link AccessTokenMode.stateless}, the generated access tokens
   * will contain all the necessary information to validate the token without
   * needing to query the database. This is useful for cases where the Resource
   * Server is on a different host/server than the Authorization Server.
   *
   * When set to {@link AccessTokenMode.light}, the access tokens will contain
   * only the necessary information to validate the token, but the token id
   * will need to be queried from the database to retrieve the full token
   * information (scope, audience, etc.)
   *
   * @see {@link AccessTokenMode}
   * @default {AccessTokenMode.stateless}
   */
  accessTokenMode?: AccessTokenMode

  /**
   * Additional metadata to be included in the discovery document.
   */
  metadata?: CustomMetadata

  /**
   * A custom fetch function that can be used to fetch the client metadata from
   * the internet. By default, the fetch function is a safeFetchWrap() function
   * that protects against SSRF attacks, large responses & known bad domains. If
   * you want to disable all protections, you can provide `globalThis.fetch` as
   * fetch function.
   */
  safeFetch?: typeof globalThis.fetch

  /**
   * A redis instance to use for replay protection. If not provided, replay
   * protection will use memory storage.
   */
  redis?: Redis | RedisOptions | string

  /**
   * This will be used as the default store for all the stores. If a store is
   * not provided, this store will be used instead. If the `store` does not
   * implement a specific store, a runtime error will be thrown. Make sure that
   * this store implements all the interfaces not provided in the other
   * `<name>Store` options.
   */
  store?: Partial<
    AccountStore &
      ClientStore &
      DeviceStore &
      ReplayStore &
      RequestStore &
      TokenStore
  >

  accountStore?: AccountStore
  clientStore?: ClientStore
  deviceStore?: DeviceStore
  replayStore?: ReplayStore
  requestStore?: RequestStore
  tokenStore?: TokenStore

  /**
   * In order to speed up the client fetching process, you can provide a cache
   * to store HTTP responses.
   *
   * @note the cached entries should automatically expire after a certain time (typically 10 minutes)
   */
  clientJwksCache?: SimpleStore<string, Jwks>

  /**
   * In order to speed up the client fetching process, you can provide a cache
   * to store HTTP responses.
   *
   * @note the cached entries should automatically expire after a certain time (typically 10 minutes)
   */
  clientMetadataCache?: SimpleStore<string, OAuthClientMetadata>

  /**
   * In order to enable loopback clients, you can provide a function that
   * returns the client metadata for a given loopback URL. This is useful for
   * development and testing purposes. This function is not called for internet
   * clients.
   *
   * @default is as specified by ATPROTO
   */
  loopbackMetadata?: null | false | LoopbackMetadataGetter
}

export type OAuthProviderOptions = OAuthProviderConfig &
  OAuthVerifierOptions &
  OAuthHooks &
  DeviceManagerOptions &
  CustomizationInput

export class OAuthProvider extends OAuthVerifier {
  protected readonly accessTokenMode: AccessTokenMode

  public readonly metadata: OAuthAuthorizationServerMetadata
  public readonly customization: Customization

  public readonly authenticationMaxAge: number

  public readonly accountManager: AccountManager
  public readonly deviceManager: DeviceManager
  public readonly clientManager: ClientManager
  public readonly requestManager: RequestManager
  public readonly tokenManager: TokenManager

  public constructor({
    // OAuthProviderConfig
    authenticationMaxAge = AUTHENTICATION_MAX_AGE,
    tokenMaxAge = TOKEN_MAX_AGE,
    accessTokenMode = AccessTokenMode.stateless,

    metadata,

    safeFetch = safeFetchWrap(),
    redis,
    store, // compound store implementation

    // Requires stores
    accountStore = asAccountStore(store),
    deviceStore = asDeviceStore(store),
    tokenStore = asTokenStore(store),

    // These are optional
    clientStore = ifClientStore(store),
    replayStore = ifReplayStore(store),
    requestStore = ifRequestStore(store),

    clientJwksCache = new SimpleStoreMemory({
      maxSize: 50_000_000,
      ttl: 600e3,
    }),
    clientMetadataCache = new SimpleStoreMemory({
      maxSize: 50_000_000,
      ttl: 600e3,
    }),

    loopbackMetadata = atprotoLoopbackClientMetadata,

    // OAuthHooks &
    // OAuthVerifierOptions &
    // DeviceManagerOptions &
    // Customization
    ...rest
  }: OAuthProviderOptions) {
    const deviceManagerOptions: DeviceManagerOptions =
      deviceManagerOptionsSchema.parse(rest)

    // @NOTE: hooks don't really need a type parser, as all zod can actually
    // check at runtime is the fact that the values are functions. The only way
    // we would benefit from zod here would be to wrap the functions with a
    // validator for the provided function's return types, which we do not add
    // because it would impact runtime performance and we trust the users of
    // this lib (basically ourselves) to rely on the typing system to ensure the
    // correct types are returned.
    const hooks: OAuthHooks = rest

    // @NOTE: validation of super params (if we wanted to implement it) should
    // be the responsibility of the super class.
    const superOptions: OAuthVerifierOptions = rest

    super({ replayStore, redis, ...superOptions })

    requestStore ??= redis
      ? new RequestStoreRedis({ redis })
      : new RequestStoreMemory()

    this.accessTokenMode = accessTokenMode
    this.authenticationMaxAge = authenticationMaxAge
    this.metadata = buildMetadata(this.issuer, this.keyset, metadata)
    this.customization = customizationSchema.parse(rest)

    this.deviceManager = new DeviceManager(deviceStore, deviceManagerOptions)
    this.accountManager = new AccountManager(
      this.issuer,
      accountStore,
      hooks,
      this.customization,
    )
    this.clientManager = new ClientManager(
      this.metadata,
      this.keyset,
      hooks,
      clientStore || null,
      loopbackMetadata || null,
      safeFetch,
      clientJwksCache,
      clientMetadataCache,
    )
    this.requestManager = new RequestManager(
      requestStore,
      this.signer,
      this.metadata,
      hooks,
    )
    this.tokenManager = new TokenManager(
      tokenStore,
      this.signer,
      hooks,
      this.accessTokenMode,
      tokenMaxAge,
    )
  }

  get jwks() {
    return this.keyset.publicJwks
  }

  /**
   * @returns true if the user's consent is required for the requested scopes
   */
  public checkConsentRequired(
    parameters: OAuthAuthorizationRequestParameters,
    clientData?: AuthorizedClientData,
  ) {
    // Client was never authorized before
    if (!clientData) return true

    // Client explicitly asked for consent
    if (parameters.prompt === 'consent') return true

    // No scope requested, and client is known by user, no consent required
    const requestedScopes = parameters.scope?.split(' ')
    if (requestedScopes == null) return false

    // Ensure that all requested scopes were previously authorized by the user
    const { authorizedScopes } = clientData
    return !requestedScopes.every((scope) => authorizedScopes.includes(scope))
  }

  public checkLoginRequired(deviceAccount: DeviceAccount) {
    const authAge = Date.now() - deviceAccount.updatedAt.getTime()
    return authAge > this.authenticationMaxAge
  }

  protected async authenticateClient(
    credentials: OAuthClientCredentials,
  ): Promise<[Client, ClientAuth]> {
    const client = await this.clientManager.getClient(credentials.client_id)
    const { clientAuth, nonce } = await client.verifyCredentials(credentials, {
      audience: this.issuer,
    })

    if (
      client.metadata.application_type === 'native' &&
      clientAuth.method !== 'none'
    ) {
      // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
      //
      // > Except when using a mechanism like Dynamic Client Registration
      // > [RFC7591] to provision per-instance secrets, native apps are
      // > classified as public clients, as defined by Section 2.1 of OAuth 2.0
      // > [RFC6749]; they MUST be registered with the authorization server as
      // > such. Authorization servers MUST record the client type in the client
      // > registration details in order to identify and process requests
      // > accordingly.

      throw new InvalidGrantError(
        'Native clients must authenticate using "none" method',
      )
    }

    if (nonce != null) {
      const unique = await this.replayManager.uniqueAuth(nonce, client.id)
      if (!unique) {
        throw new InvalidGrantError(`${clientAuth.method} jti reused`)
      }
    }

    return [client, clientAuth]
  }

  protected async decodeJAR(
    client: Client,
    input: OAuthAuthorizationRequestJar,
  ): Promise<
    | {
        payload: OAuthAuthorizationRequestParameters
      }
    | {
        payload: OAuthAuthorizationRequestParameters
        protectedHeader: { kid: string; alg: string }
        jkt: string
      }
  > {
    const result = await client.decodeRequestObject(input.request)
    const payload = oauthAuthorizationRequestParametersSchema.parse(
      result.payload,
    )

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
        jkt: await authJwkThumbprint(result.key),
        payload,
        protectedHeader: result.protectedHeader as {
          alg: string
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
  public async pushedAuthorizationRequest(
    credentials: OAuthClientCredentials,
    authorizationRequest: OAuthAuthorizationRequestPar,
    dpopProof: null | DpopProof,
  ): Promise<OAuthParResponse> {
    try {
      const [client, clientAuth] = await this.authenticateClient(credentials)

      const { payload: parameters } =
        'request' in authorizationRequest // Handle JAR
          ? await this.decodeJAR(client, authorizationRequest)
          : { payload: authorizationRequest }

      const { uri, expiresAt } =
        await this.requestManager.createAuthorizationRequest(
          client,
          clientAuth,
          parameters,
          null,
          dpopProof,
        )

      return {
        request_uri: uri,
        expires_in: dateToRelativeSeconds(expiresAt),
      }
    } catch (err) {
      // https://datatracker.ietf.org/doc/html/rfc9126#section-2.3-1
      // > Since initial processing of the pushed authorization request does not
      // > involve resource owner interaction, error codes related to user
      // > interaction, such as "access_denied", are never returned.
      if (err instanceof AccessDeniedError) {
        throw new InvalidRequestError(err.error_description, err)
      }
      throw err
    }
  }

  private async processAuthorizationRequest(
    client: Client,
    deviceId: DeviceId,
    query: OAuthAuthorizationRequestQuery,
  ): Promise<RequestInfo> {
    if ('request_uri' in query) {
      const requestUri = await requestUriSchema
        .parseAsync(query.request_uri, { path: ['query', 'request_uri'] })
        .catch((err) => {
          throw new InvalidRequestError(
            extractZodErrorMessage(err) ?? 'Input validation error',
            err,
          )
        })

      return this.requestManager.get(requestUri, deviceId, client.id)
    }

    if ('request' in query) {
      const requestObject = await this.decodeJAR(client, query)

      if ('protectedHeader' in requestObject && requestObject.protectedHeader) {
        // Allow using signed JAR during "/authorize" as client authentication.
        // This allows clients to skip PAR to initiate trusted sessions.
        const clientAuth: ClientAuth = {
          method: CLIENT_ASSERTION_TYPE_JWT_BEARER,
          kid: requestObject.protectedHeader.kid,
          alg: requestObject.protectedHeader.alg,
          jkt: requestObject.jkt,
        }

        return this.requestManager.createAuthorizationRequest(
          client,
          clientAuth,
          requestObject.payload,
          deviceId,
          null,
        )
      }

      return this.requestManager.createAuthorizationRequest(
        client,
        { method: 'none' },
        requestObject.payload,
        deviceId,
        null,
      )
    }

    return this.requestManager.createAuthorizationRequest(
      client,
      { method: 'none' },
      query,
      deviceId,
      null,
    )
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-4.1.1}
   */
  public async authorize(
    clientCredentials: OAuthClientCredentialsNone,
    query: OAuthAuthorizationRequestQuery,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<AuthorizationResultRedirect | AuthorizationResultAuthorizePage> {
    const { issuer } = this

    // If there is a chance to redirect the user to the client, let's do
    // it by wrapping the error in an AccessDeniedError.
    const accessDeniedCatcher =
      'redirect_uri' in query
        ? (err: unknown): never => {
            // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-4.1.2.1
            throw AccessDeniedError.from(query, err, 'invalid_request')
          }
        : null

    const client = await this.clientManager
      .getClient(clientCredentials.client_id)
      .catch(accessDeniedCatcher)

    const { parameters, uri } = await this.processAuthorizationRequest(
      client,
      deviceId,
      query,
    ).catch(accessDeniedCatcher)

    try {
      const sessions = await this.getSessions(client.id, deviceId, parameters)

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

        const code = await this.requestManager.setAuthorized(
          uri,
          client,
          ssoSession.account,
          deviceId,
          deviceMetadata,
        )

        return { issuer, parameters, redirect: { code } }
      }

      // Automatic SSO when a did was provided
      if (parameters.prompt == null && parameters.login_hint != null) {
        const ssoSessions = sessions.filter((s) => s.matchesHint)
        if (ssoSessions.length === 1) {
          const ssoSession = ssoSessions[0]!
          if (!ssoSession.loginRequired && !ssoSession.consentRequired) {
            const code = await this.requestManager.setAuthorized(
              uri,
              client,
              ssoSession.account,
              deviceId,
              deviceMetadata,
            )

            return { issuer, parameters, redirect: { code } }
          }
        }
      }

      return {
        issuer,
        client,
        parameters,
        uri,
        sessions: sessions.map((session) => ({
          // Map to avoid leaking other data that might be present in the session
          account: session.account,
          selected: session.selected,
          loginRequired: session.loginRequired,
          consentRequired: session.consentRequired,
        })),
        scopeDetails: parameters.scope
          ?.split(/\s+/)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((scope) => ({
            scope,
            // @TODO Allow to customize the scope descriptions (e.g.
            // using a hook)
            description: undefined,
          })),
      }
    } catch (err) {
      try {
        await this.requestManager.delete(uri)
      } catch {
        // There are two error here. Better keep the outer one.
        //
        // @TODO Maybe move this entire code to the /authorize endpoint
        // (allowing to log this error)
      }

      // Not using accessDeniedCatcher here because "parameters" will most
      // likely contain the redirect_uri (using the client default).
      throw AccessDeniedError.from(parameters, err, 'server_error')
    }
  }

  protected async getSessions(
    clientId: ClientId,
    deviceId: DeviceId,
    parameters: OAuthAuthorizationRequestParameters,
  ): Promise<
    {
      account: Account

      selected: boolean
      loginRequired: boolean
      consentRequired: boolean

      matchesHint: boolean
    }[]
  > {
    const deviceAccounts =
      await this.accountManager.listDeviceAccounts(deviceId)

    const hint = parameters.login_hint
    const matchesHint = (account: Account): boolean =>
      (!!account.sub && account.sub === hint) ||
      (!!account.preferred_username && account.preferred_username === hint)

    return deviceAccounts.map((deviceAccount) => ({
      account: deviceAccount.account,

      selected:
        parameters.prompt !== 'select_account' &&
        matchesHint(deviceAccount.account),
      // @TODO Return the session expiration date instead of a boolean to
      // avoid having to rely on a leeway when "accepting" the request.
      loginRequired:
        parameters.prompt === 'login' || this.checkLoginRequired(deviceAccount),
      consentRequired: this.checkConsentRequired(
        parameters,
        deviceAccount.authorizedClients.get(clientId),
      ),

      matchesHint: hint == null || matchesHint(deviceAccount.account),
    }))
  }

  public async token(
    clientCredentials: OAuthClientCredentials,
    clientMetadata: RequestMetadata,
    request: OAuthTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const [client, clientAuth] =
      await this.authenticateClient(clientCredentials)

    if (!this.metadata.grant_types_supported?.includes(request.grant_type)) {
      throw new InvalidGrantError(
        `Grant type "${request.grant_type}" is not supported by the server`,
      )
    }

    if (!client.metadata.grant_types.includes(request.grant_type)) {
      throw new InvalidGrantError(
        `"${request.grant_type}" grant type is not allowed for this client`,
      )
    }

    if (request.grant_type === 'authorization_code') {
      return this.codeGrant(
        client,
        clientAuth,
        clientMetadata,
        request,
        dpopProof,
      )
    }

    if (request.grant_type === 'refresh_token') {
      return this.refreshTokenGrant(
        client,
        clientAuth,
        clientMetadata,
        request,
        dpopProof,
      )
    }

    throw new InvalidGrantError(
      `Grant type "${request.grant_type}" not supported`,
    )
  }

  protected async codeGrant(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    input: OAuthAuthorizationCodeGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const code = codeSchema.parse(input.code)
    try {
      const { sub, deviceId, parameters } = await this.requestManager.findCode(
        client,
        clientAuth,
        code,
      )

      // the following check prevents re-use of PKCE challenges, enforcing the
      // clients to generate a new challenge for each authorization request. The
      // replay manager typically prevents replay over a certain time frame,
      // which might not cover the entire lifetime of the token (depending on
      // the implementation of the replay store). For this reason, we should
      // ideally ensure that the code_challenge was not already used by any
      // existing token or any other pending request.
      //
      // The current implementation will cause client devs not issuing a new
      // code challenge for each authorization request to fail, which should be
      // a good enough incentive to follow the best practices, until we have a
      // better implementation.
      //
      // @TODO Use tokenManager to ensure uniqueness of code_challenge
      if (parameters.code_challenge) {
        const unique = await this.replayManager.uniqueCodeChallenge(
          parameters.code_challenge,
        )
        if (!unique) {
          throw new InvalidGrantError('Code challenge already used')
        }
      }

      const { account } = await this.accountManager.getAccount(sub)

      return await this.tokenManager.create(
        client,
        clientAuth,
        clientMetadata,
        account,
        deviceId,
        parameters,
        input,
        dpopProof,
      )
    } catch (err) {
      // If a token is replayed, requestManager.findCode will throw. In that
      // case, we need to revoke any token that was issued for this code.

      const tokenInfo = await this.tokenManager.findByCode(code)
      if (tokenInfo) {
        await this.tokenManager.deleteToken(tokenInfo.id)

        //  As an additional security measure, we also sign the device out, so
        // that the device cannot be used to access the account anymore without
        // a new authentication.
        const { deviceId, sub } = tokenInfo.data
        if (deviceId) {
          await this.accountManager.removeDeviceAccount(deviceId, sub)
        }
      }

      throw err
    }
  }

  async refreshTokenGrant(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    input: OAuthRefreshTokenGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    return this.tokenManager.refresh(
      client,
      clientAuth,
      clientMetadata,
      input,
      dpopProof,
    )
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7009#section-2.1 rfc7009}
   */
  public async revoke(
    credentials: OAuthClientCredentials,
    { token }: OAuthTokenIdentification,
  ) {
    // > The authorization server first validates the client credentials (in
    // > case of a confidential client)
    const [client, clientAuth] = await this.authenticateClient(credentials)

    const tokenInfo = await this.tokenManager.findToken(token)

    // > [...] and then verifies whether the token was issued to the client
    // > making the revocation request. If this validation fails, the request is
    // > refused and the client is informed of the error by the authorization
    // > server as described below.
    await this.tokenManager.validateAccess(client, clientAuth, tokenInfo)

    // > In the next step, the authorization server invalidates the token. The
    // > invalidation takes place immediately, and the token cannot be used
    // > again after the revocation.
    await this.tokenManager.deleteToken(tokenInfo.id)
  }

  protected override async verifyToken(
    tokenType: OAuthTokenType,
    token: OAuthAccessToken,
    dpopProof: null | DpopProof,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<VerifyTokenClaimsResult> {
    if (this.accessTokenMode === AccessTokenMode.stateless) {
      return super.verifyToken(tokenType, token, dpopProof, verifyOptions)
    }

    if (this.accessTokenMode === AccessTokenMode.light) {
      const { tokenClaims } = await super.verifyToken(
        tokenType,
        token,
        dpopProof,
        // Do not verify the scope and audience in case of "light" tokens.
        // these will be checked through the tokenManager hereafter.
        undefined,
      )

      const tokenId = tokenClaims.jti

      // In addition to verifying the signature (through the verifier above), we
      // also verify the tokenId is still valid using a database to fetch
      // missing data from "light" token.
      return this.tokenManager.verifyToken(
        token,
        tokenType,
        tokenId,
        dpopProof,
        verifyOptions,
      )
    }

    // Fool-proof
    throw new Error('Invalid access token mode')
  }
}
