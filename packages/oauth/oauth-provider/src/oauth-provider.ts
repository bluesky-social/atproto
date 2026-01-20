import { createHash } from 'node:crypto'
import type { Redis, RedisOptions } from 'ioredis'
import { Jwks, Keyset } from '@atproto/jwk'
import { LexResolver } from '@atproto/lex-resolver'
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
import { ClientAuth, ClientAuthLegacy } from './client/client-auth.js'
import { ClientId } from './client/client-id.js'
import {
  ClientManager,
  LoopbackMetadataGetter,
} from './client/client-manager.js'
import { ClientStore, ifClientStore } from './client/client-store.js'
import { Client } from './client/client.js'
import {
  AUTHENTICATION_MAX_AGE,
  CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
  CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
  PUBLIC_CLIENT_REFRESH_LIFETIME,
  PUBLIC_CLIENT_SESSION_LIFETIME,
  TOKEN_MAX_AGE,
} from './constants.js'
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
import { AccountSelectionRequiredError } from './errors/account-selection-required-error.js'
import { AuthorizationError } from './errors/authorization-error.js'
import { ConsentRequiredError } from './errors/consent-required-error.js'
import { InvalidDpopKeyBindingError } from './errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from './errors/invalid-dpop-proof-error.js'
import { InvalidGrantError } from './errors/invalid-grant-error.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { LoginRequiredError } from './errors/login-required-error.js'
import { LexiconManager } from './lexicon/lexicon-manager.js'
import { LexiconStore, asLexiconStore } from './lexicon/lexicon-store.js'
import { HcaptchaConfig } from './lib/hcaptcha.js'
import { RequestMetadata } from './lib/http/request.js'
import { dateToRelativeSeconds } from './lib/util/date.js'
import { formatError } from './lib/util/error.js'
import { MultiLangString } from './lib/util/locale.js'
import { CustomMetadata, buildMetadata } from './metadata/build-metadata.js'
import { OAuthHooks } from './oauth-hooks.js'
import {
  DpopProof,
  OAuthVerifier,
  OAuthVerifierOptions,
  VerifyTokenPayloadOptions,
} from './oauth-verifier.js'
import { ReplayStore, ifReplayStore } from './replay/replay-store.js'
import { codeSchema } from './request/code.js'
import { RequestManager } from './request/request-manager.js'
import { RequestStore, asRequestStore } from './request/request-store.js'
import { requestUriSchema } from './request/request-uri.js'
import { AuthorizationRedirectParameters } from './result/authorization-redirect-parameters.js'
import { AuthorizationResultAuthorizePage } from './result/authorization-result-authorize-page.js'
import { AuthorizationResultRedirect } from './result/authorization-result-redirect.js'
import { ErrorHandler } from './router/error-handler.js'
import { AccessTokenPayload } from './signer/access-token-payload.js'
import { TokenData } from './token/token-data.js'
import { TokenManager } from './token/token-manager.js'
import {
  TokenStore,
  asTokenStore,
  refreshTokenSchema,
} from './token/token-store.js'
import { isPARResponseError } from './types/par-response-error.js'

export { AccessTokenMode, Keyset, LexResolver }
export type {
  AccessTokenPayload,
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
  MultiLangString,
  OAuthAuthorizationServerMetadata,
  VerifyTokenPayloadOptions,
}

type OAuthProviderConfig = {
  /**
   * Maximum age a device/account session can be before requiring
   * re-authentication.
   */
  authenticationMaxAge?: number

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
   * A Lexicon resolver instance to use for fetching lexicon schemas.
   */
  lexResolver?: LexResolver

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
      LexiconStore &
      ReplayStore &
      RequestStore &
      TokenStore
  >

  accountStore?: AccountStore
  clientStore?: ClientStore
  deviceStore?: DeviceStore
  lexiconStore?: LexiconStore
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
  protected readonly hooks: OAuthHooks

  public readonly metadata: OAuthAuthorizationServerMetadata
  public readonly customization: Customization

  public readonly authenticationMaxAge: number

  public readonly accountManager: AccountManager
  public readonly deviceManager: DeviceManager
  public readonly clientManager: ClientManager
  public readonly lexiconManager: LexiconManager
  public readonly requestManager: RequestManager
  public readonly tokenManager: TokenManager

  public constructor({
    // OAuthProviderConfig
    authenticationMaxAge = AUTHENTICATION_MAX_AGE,
    tokenMaxAge = TOKEN_MAX_AGE,
    accessTokenMode = AccessTokenMode.stateless,

    metadata,

    safeFetch = safeFetchWrap(),
    store, // compound store implementation
    lexResolver = new LexResolver({ fetch: safeFetch }),

    // Required stores
    accountStore = asAccountStore(store),
    deviceStore = asDeviceStore(store),
    lexiconStore = asLexiconStore(store),
    tokenStore = asTokenStore(store),
    requestStore = asRequestStore(store),

    // Optional stores
    clientStore = ifClientStore(store),
    replayStore = ifReplayStore(store),

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

    super({ replayStore, ...rest })

    // @NOTE: hooks don't really need a type parser, as all zod can actually
    // check at runtime is the fact that the values are functions. The only way
    // we would benefit from zod here would be to wrap the functions with a
    // validator for the provided function's return types, which we don't
    // really need if types are respected.
    this.hooks = rest

    this.accessTokenMode = accessTokenMode
    this.authenticationMaxAge = authenticationMaxAge
    this.metadata = buildMetadata(this.issuer, this.keyset, metadata)
    this.customization = customizationSchema.parse(rest)

    this.deviceManager = new DeviceManager(deviceStore, deviceManagerOptions)
    this.accountManager = new AccountManager(
      this.issuer,
      accountStore,
      this.hooks,
      this.customization,
    )
    this.clientManager = new ClientManager(
      this.metadata,
      this.keyset,
      this.hooks,
      clientStore || null,
      loopbackMetadata || null,
      safeFetch,
      clientJwksCache,
      clientMetadataCache,
    )
    this.lexiconManager = new LexiconManager(lexiconStore, lexResolver)
    this.requestManager = new RequestManager(
      requestStore,
      this.lexiconManager,
      this.signer,
      this.metadata,
      this.hooks,
    )
    this.tokenManager = new TokenManager(
      tokenStore,
      this.lexiconManager,
      this.signer,
      this.hooks,
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
    clientCredentials: OAuthClientCredentials,
    dpopProof: null | DpopProof,
    options?: {
      allowMissingDpopProof?: boolean
    },
  ): Promise<{
    client: Client
    clientAuth: ClientAuth
  }> {
    const client = await this.clientManager.getClient(
      clientCredentials.client_id,
    )

    if (
      client.metadata.dpop_bound_access_tokens &&
      !dpopProof &&
      !options?.allowMissingDpopProof
    ) {
      throw new InvalidDpopProofError('DPoP proof required')
    }

    if (dpopProof && !client.metadata.dpop_bound_access_tokens) {
      throw new InvalidDpopProofError('DPoP proof not allowed for this client')
    }

    const clientAuth = await client.authenticate(clientCredentials, {
      authorizationServerIdentifier: this.issuer,
    })

    if (clientAuth.method === 'private_key_jwt') {
      // Clients MUST NOT use their client assertion key to sign DPoP proofs
      if (dpopProof && clientAuth.jkt === dpopProof.jkt) {
        throw new InvalidRequestError(
          'The DPoP proof must be signed with a different key than the client assertion',
        )
      }

      // https://www.rfc-editor.org/rfc/rfc7523.html#section-3
      // > 7.  [...] The authorization server MAY ensure that JWTs are not
      // >     replayed by maintaining the set of used "jti" values for the
      // >     length of time for which the JWT would be considered valid based
      // >     on the applicable "exp" instant.

      const unique = await this.replayManager.uniqueAuth(
        clientAuth.jti,
        client.id,
        clientAuth.exp,
      )
      if (!unique) {
        throw new InvalidGrantError(`${clientAuth.method} jti reused`)
      }
    }

    return { client, clientAuth }
  }

  protected async decodeJAR(
    client: Client,
    input: OAuthAuthorizationRequestJar,
  ): Promise<OAuthAuthorizationRequestParameters> {
    const { payload } = await client.decodeRequestObject(
      input.request,
      this.issuer,
    )

    const { jti } = payload
    if (!jti) {
      throw new InvalidRequestError(
        'Request object payload must contain a "jti" claim',
      )
    }
    if (!(await this.replayManager.uniqueJar(jti, client.id))) {
      throw new InvalidRequestError('Request object was replayed')
    }

    const parameters = await oauthAuthorizationRequestParametersSchema
      .parseAsync(payload)
      .catch((err) => {
        const msg = formatError(err, 'Invalid parameters in JAR')
        throw new InvalidRequestError(msg, err)
      })

    return parameters
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
      const { client, clientAuth } = await this.authenticateClient(
        credentials,
        dpopProof,
        // Allow missing DPoP header for PAR requests as rfc9449 allows it
        // (though the dpop_jkt parameter must be present in that case, see
        // check bellow).
        { allowMissingDpopProof: true },
      )

      const parameters =
        'request' in authorizationRequest // Handle JAR
          ? await this.decodeJAR(client, authorizationRequest)
          : authorizationRequest

      if (!parameters.dpop_jkt) {
        if (client.metadata.dpop_bound_access_tokens) {
          if (dpopProof) parameters.dpop_jkt = dpopProof.jkt
          else {
            // @NOTE When both PAR and DPoP are used, either the DPoP header, or
            // the dpop_jkt parameter must be present. We do not enforce this
            // for legacy reasons.
            // https://datatracker.ietf.org/doc/html/rfc9449#section-10.1
          }
        }
      } else {
        if (!client.metadata.dpop_bound_access_tokens) {
          throw new InvalidRequestError(
            'DPoP bound access tokens are not enabled for this client',
          )
        }

        // Proof is optional if the dpop_jkt is provided, but if it is provided,
        // it must match the DPoP proof JKT.
        if (dpopProof && dpopProof.jkt !== parameters.dpop_jkt) {
          throw new InvalidDpopKeyBindingError()
        }
      }

      const { requestUri, expiresAt } =
        await this.requestManager.createAuthorizationRequest(
          client,
          clientAuth,
          parameters,
          null,
        )

      return {
        request_uri: requestUri,
        expires_in: dateToRelativeSeconds(expiresAt),
      }
    } catch (err) {
      // https://datatracker.ietf.org/doc/html/rfc9126#section-2.3-1
      // > Since initial processing of the pushed authorization request does not
      // > involve resource owner interaction, error codes related to user
      // > interaction, such as "access_denied", are never returned.
      if (err instanceof AuthorizationError && !isPARResponseError(err.error)) {
        throw new InvalidRequestError(err.error_description, err)
      }
      throw err
    }
  }

  private async processAuthorizationRequest(
    client: Client,
    deviceId: DeviceId,
    query: OAuthAuthorizationRequestQuery,
  ) {
    // PAR
    if ('request_uri' in query) {
      const requestUri = await requestUriSchema
        .parseAsync(query.request_uri, { path: ['query', 'request_uri'] })
        .catch((err) => {
          const msg = formatError(err, 'Invalid "request_uri" query parameter')
          throw new InvalidRequestError(msg, err)
        })

      return this.requestManager.get(requestUri, deviceId, client.id)
    }

    // JAR
    if ('request' in query) {
      // @NOTE Since JAR are signed with the client's private key, a JAR *could*
      // technically be used to authenticate the client when requests are
      // created without PAR (i.e. created on the fly by the authorize
      // endpoint). This implementation actually used to support this
      // (un-spec'd) behavior. That support was removed:
      // - Because it was not actually used
      // - Because it was not part of any standard
      // - Because it makes extending the client authentication mechanism more
      //   complex since any extension would not only need to affect the
      //   "private_key_jwt" auth method but also the JAR "request" object.
      const parameters = await this.decodeJAR(client, query)

      return this.requestManager.createAuthorizationRequest(
        client,
        null,
        parameters,
        deviceId,
      )
    }

    // "Regular" authorization request (created on the fly by directing the user
    // to the authorization endpoint with all the parameters in the url).
    return this.requestManager.createAuthorizationRequest(
      client,
      null,
      query,
      deviceId,
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
    // it by wrapping the error in an AuthorizationError.
    const throwAuthorizationError =
      'redirect_uri' in query
        ? (err: unknown): never => {
            // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-4.1.2.1
            throw AuthorizationError.from(query, err)
          }
        : null

    const client = await this.clientManager
      .getClient(clientCredentials.client_id)
      .catch(throwAuthorizationError)

    const { parameters, requestUri } = await this.processAuthorizationRequest(
      client,
      deviceId,
      query,
    ).catch(throwAuthorizationError)

    try {
      const sessions = (
        await this.accountManager.listDeviceAccounts(deviceId)
      ).map((deviceAccount) => ({
        account: deviceAccount.account,

        // @TODO Return the session expiration date instead of a boolean to
        // avoid having to rely on a leeway when "accepting" the request.
        loginRequired:
          parameters.prompt === 'login' ||
          this.checkLoginRequired(deviceAccount),
        consentRequired: this.checkConsentRequired(
          parameters,
          deviceAccount.authorizedClients.get(client.id),
        ),
      }))

      // https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest

      // prompt=select_account
      //
      // > The Authorization Server SHOULD prompt the End-User to select a user
      // > account. This enables an End-User who has multiple accounts at the
      // > Authorization Server to select amongst the multiple accounts that
      // > they might have current sessions for. If it cannot obtain an account
      // > selection choice made by the End-User, it MUST return an error,
      // > typically account_selection_required.
      if (parameters.prompt === 'select_account' && !sessions.length) {
        throw new AccountSelectionRequiredError(parameters)
      }

      // prompt=none
      //
      // > The Authorization Server MUST NOT display any authentication or
      // > consent user interface pages. An error is returned if an End-User is
      // > not already authenticated or the Client does not have pre-configured
      // > consent for the requested Claims or does not fulfill other conditions
      // > for processing the request. The error code will typically be
      // > login_required, interaction_required, or another code defined in
      // > Section 3.1.2.6. This can be used as a method to check for existing
      // > authentication and/or consent.
      if (parameters.prompt === 'none') {
        const ssoSessions = sessions.filter(matchesHint, parameters)
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
          requestUri,
          client,
          ssoSession.account,
          deviceId,
          deviceMetadata,
        )

        return { issuer, parameters, redirect: { code } }
      }

      // Automatic SSO when a hint was provided that matches a single session
      if (parameters.prompt == null && parameters.login_hint != null) {
        const ssoSessions = sessions.filter(matchesHint, parameters)
        if (ssoSessions.length === 1) {
          const ssoSession = ssoSessions[0]!
          if (!ssoSession.loginRequired && !ssoSession.consentRequired) {
            const code = await this.requestManager.setAuthorized(
              requestUri,
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
        requestUri,
        sessions: sessions.map((session) => ({
          // Map to avoid leaking other data that might be present in the session
          account: session.account,
          loginRequired: session.loginRequired,
          consentRequired: session.consentRequired,

          selected:
            parameters.prompt == null ||
            parameters.prompt === 'login' ||
            parameters.prompt === 'consent'
              ? matchesHint.call(parameters, session)
              : false,
        })),
        permissionSets: await this.lexiconManager
          .getPermissionSetsFromScope(parameters.scope)
          .catch((cause) => {
            throw new AuthorizationError(
              parameters,
              'Unable to retrieve permission sets',
              'invalid_scope',
              cause,
            )
          }),
      }
    } catch (err) {
      try {
        await this.requestManager.delete(requestUri)
      } catch {
        // There are two error here. Better keep the outer one.
        //
        // @TODO Maybe move this entire code to the /authorize endpoint
        // (allowing to log this error)
      }

      throw AuthorizationError.from(parameters, err)
    }
  }

  public async token(
    clientCredentials: OAuthClientCredentials,
    clientMetadata: RequestMetadata,
    request: OAuthTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const { client, clientAuth } = await this.authenticateClient(
      clientCredentials,
      dpopProof,
    )

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
      return this.authorizationCodeGrant(
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

  protected async compareClientAuth(
    client: Client,
    clientAuth: ClientAuth,
    dpopProof: null | DpopProof,
    initial: {
      parameters: OAuthAuthorizationRequestParameters
      clientId: ClientId
      clientAuth: null | ClientAuth | ClientAuthLegacy
    },
  ): Promise<void> {
    // Fool proofing, ensure that the client is authenticating using the right method
    if (clientAuth.method !== client.metadata.token_endpoint_auth_method) {
      throw new InvalidGrantError(
        `Client authentication method mismatch (expected ${client.metadata.token_endpoint_auth_method}, got ${clientAuth.method})`,
      )
    }

    if (initial.clientId !== client.id) {
      throw new InvalidGrantError(`Token was not issued to this client`)
    }

    const { parameters } = initial
    if (parameters.dpop_jkt) {
      if (!dpopProof) {
        throw new InvalidGrantError(`DPoP proof is required for this request`)
      } else if (parameters.dpop_jkt !== dpopProof.jkt) {
        throw new InvalidGrantError(
          `DPoP proof does not match the expected JKT`,
        )
      }
    }

    if (!initial.clientAuth) {
      // If the client did not use PAR, it was not authenticated when the request
      // was initially created (see authorize() method in OAuthProvider). Since
      // PAR is not mandatory, and since the token exchange currently taking place
      // *is* authenticated (`clientAuth`), we allow "upgrading" the
      // authentication method (the token created will be bound to the current
      // clientAuth).
      return
    }

    switch (initial.clientAuth.method) {
      case CLIENT_ASSERTION_TYPE_JWT_BEARER: // LEGACY
      case 'private_key_jwt':
        if (clientAuth.method !== 'private_key_jwt') {
          throw new InvalidGrantError(
            `Client authentication method mismatch (expected ${initial.clientAuth.method})`,
          )
        }
        if (
          clientAuth.kid !== initial.clientAuth.kid ||
          clientAuth.alg !== initial.clientAuth.alg ||
          clientAuth.jkt !== initial.clientAuth.jkt
        ) {
          throw new InvalidGrantError(
            `The session was initiated with a different key than the client assertion currently used`,
          )
        }
        break
      case 'none':
        // @NOTE We allow the client to "upgrade" to a confidential client if
        // the session was initially created without client authentication.
        break
      default:
        throw new InvalidGrantError(
          // @ts-expect-error (future proof, backwards compatibility)
          `Invalid method "${initial.clientAuth.method}"`,
        )
    }
  }

  protected async authorizationCodeGrant(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    input: OAuthAuthorizationCodeGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const code = await codeSchema
      .parseAsync(input.code, { path: ['code'] })
      .catch((err) => {
        const msg = formatError(err, 'Invalid code')
        throw new InvalidGrantError(msg, err)
      })

    const data = await this.requestManager
      .consumeCode(code)
      .catch(async (err) => {
        // Code not found in request manager: check for replays
        const tokenInfo = await this.tokenManager.findByCode(code)
        if (tokenInfo) {
          // try/finally to ensure that both code path get executed (sequentially)
          try {
            // "code" was replayed, delete existing session
            await this.tokenManager.deleteToken(tokenInfo.id)
          } finally {
            // As an additional security measure, we also sign the device out,
            // so that the device cannot be used to access the account anymore
            // without a new authentication.
            const { deviceId, sub } = tokenInfo.data
            if (deviceId) {
              await this.accountManager.removeDeviceAccount(deviceId, sub)
            }
          }
        }

        throw InvalidGrantError.from(err, `Invalid code`)
      })

    // @NOTE at this point, the request data was removed from the store and only
    // exists in memory here (in the "data" variable). Because of this, any
    // error thrown after this point will permanently cause the request data to
    // be lost.

    await this.compareClientAuth(client, clientAuth, dpopProof, data)

    // If the DPoP proof was not provided earlier (PAR / authorize), let's add
    // it now.
    const parameters =
      dpopProof &&
      client.metadata.dpop_bound_access_tokens &&
      !data.parameters.dpop_jkt
        ? { ...data.parameters, dpop_jkt: dpopProof.jkt }
        : data.parameters

    await this.validateCodeGrant(parameters, input)

    const { account } = await this.accountManager.getAccount(data.sub)

    return this.tokenManager.createToken(
      client,
      clientAuth,
      clientMetadata,
      account,
      data.deviceId,
      parameters,
      code,
    )
  }

  protected async validateCodeGrant(
    parameters: OAuthAuthorizationRequestParameters,
    input: OAuthAuthorizationCodeGrantTokenRequest,
  ): Promise<void> {
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
      switch (parameters.code_challenge_method) {
        case undefined: // default is "plain"
        case 'plain':
          if (parameters.code_challenge !== input.code_verifier) {
            throw new InvalidGrantError('Invalid code_verifier')
          }
          break

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

        default:
          // Should never happen (because request validation should catch this)
          throw new Error(`Unsupported code_challenge_method`)
      }
      const unique = await this.replayManager.uniqueCodeChallenge(
        parameters.code_challenge,
      )
      if (!unique) {
        throw new InvalidGrantError('Code challenge already used')
      }
    } else if (input.code_verifier !== undefined) {
      throw new InvalidRequestError("code_challenge parameter wasn't provided")
    }
  }

  protected async refreshTokenGrant(
    client: Client,
    clientAuth: ClientAuth,
    clientMetadata: RequestMetadata,
    input: OAuthRefreshTokenGrantTokenRequest,
    dpopProof: null | DpopProof,
  ): Promise<OAuthTokenResponse> {
    const refreshToken = await refreshTokenSchema
      .parseAsync(input.refresh_token, { path: ['refresh_token'] })
      .catch((err) => {
        const msg = formatError(err, 'Invalid refresh token')
        throw new InvalidGrantError(msg, err)
      })

    const tokenInfo = await this.tokenManager.consumeRefreshToken(refreshToken)

    try {
      const { data } = tokenInfo
      await this.compareClientAuth(client, clientAuth, dpopProof, data)
      await this.validateRefreshGrant(client, clientAuth, data)

      return await this.tokenManager.rotateToken(
        client,
        clientAuth,
        clientMetadata,
        tokenInfo,
      )
    } catch (err) {
      await this.tokenManager.deleteToken(tokenInfo.id)

      throw err
    }
  }

  protected async validateRefreshGrant(
    client: Client,
    clientAuth: ClientAuth,
    data: TokenData,
  ): Promise<void> {
    const [sessionLifetime, refreshLifetime] =
      clientAuth.method !== 'none' || client.info.isFirstParty
        ? [
            CONFIDENTIAL_CLIENT_SESSION_LIFETIME,
            CONFIDENTIAL_CLIENT_REFRESH_LIFETIME,
          ]
        : [PUBLIC_CLIENT_SESSION_LIFETIME, PUBLIC_CLIENT_REFRESH_LIFETIME]

    const sessionAge = Date.now() - data.createdAt.getTime()
    if (sessionAge > sessionLifetime) {
      throw new InvalidGrantError(`Session expired`)
    }

    const refreshAge = Date.now() - data.updatedAt.getTime()
    if (refreshAge > refreshLifetime) {
      throw new InvalidGrantError(`Refresh token expired`)
    }
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7009#section-2.1 rfc7009}
   */
  public async revoke(
    clientCredentials: OAuthClientCredentials,
    { token }: OAuthTokenIdentification,
    dpopProof: null | DpopProof,
  ) {
    // > The authorization server first validates the client credentials (in
    // > case of a confidential client)
    const { client, clientAuth } = await this.authenticateClient(
      clientCredentials,
      dpopProof,
    )

    const tokenInfo = await this.tokenManager.findToken(token)
    if (tokenInfo) {
      // > [...] and then verifies whether the token was issued to the client
      // > making the revocation request.
      const { data } = tokenInfo
      await this.compareClientAuth(client, clientAuth, dpopProof, data)

      // > In the next step, the authorization server invalidates the token. The
      // > invalidation takes place immediately, and the token cannot be used
      // > again after the revocation.
      await this.tokenManager.deleteToken(tokenInfo.id)
    }
  }

  protected override async decodeToken(
    tokenType: OAuthTokenType,
    token: OAuthAccessToken,
    dpopProof: null | DpopProof,
  ): Promise<AccessTokenPayload> {
    const tokenPayload = await super.decodeToken(tokenType, token, dpopProof)

    if (this.accessTokenMode !== AccessTokenMode.stateless) {
      // @NOTE in non stateless mode, some claims can be omitted (most notably
      // "scope"). We load the token claims here (allowing to ensure that the
      // token is still valid, and to retrieve a (potentially updated) set of
      // claims).

      const tokenClaims = await this.tokenManager.loadTokenClaims(
        tokenType,
        tokenPayload,
      )

      Object.assign(tokenPayload, tokenClaims)
    }

    return tokenPayload
  }
}

function matchesHint(
  this: OAuthAuthorizationRequestParameters,
  { account }: { account: Account },
): boolean {
  const hint = this.login_hint
  if (!hint) return false

  return account.sub === hint || account.preferred_username === hint
}
