import {
  DidCache,
  DidResolverCached,
  DidResolverCommon,
} from '@atproto-labs/did-resolver'
import { Fetch } from '@atproto-labs/fetch'
import {
  AppViewHandleResolver,
  CachedHandleResolver,
  HandleCache,
  HandleResolver,
} from '@atproto-labs/handle-resolver'
import { IdentityResolver } from '@atproto-labs/identity-resolver'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { Key, Keyset } from '@atproto/jwk'
import {
  OAuthClientIdDiscoverable,
  OAuthClientMetadata,
  OAuthClientMetadataInput,
  oauthClientMetadataSchema,
  OAuthResponseMode,
} from '@atproto/oauth-types'

import { FALLBACK_ALG } from './constants.js'
import { TokenRevokedError } from './errors/token-revoked-error.js'
import {
  AuthorizationServerMetadataCache,
  OAuthAuthorizationServerMetadataResolver,
} from './oauth-authorization-server-metadata-resolver.js'
import { OAuthCallbackError } from './oauth-callback-error.js'
import {
  OAuthProtectedResourceMetadataResolver,
  ProtectedResourceMetadataCache,
} from './oauth-protected-resource-metadata-resolver.js'
import { OAuthResolver } from './oauth-resolver.js'
import { DpopNonceCache, OAuthServerAgent } from './oauth-server-agent.js'
import { OAuthServerFactory } from './oauth-server-factory.js'
import { OAuthSession } from './oauth-session.js'
import { RuntimeImplementation } from './runtime-implementation.js'
import { Runtime } from './runtime.js'
import {
  SessionEventMap,
  SessionGetter,
  SessionStore,
} from './session-getter.js'
import { InternalStateData, StateStore } from './state-store.js'
import { AuthorizeOptions, ClientMetadata } from './types.js'
import { CustomEventTarget } from './util.js'
import { validateClientMetadata } from './validate-client-metadata.js'

// Export all types needed to construct OAuthClientOptions
export type {
  AuthorizationServerMetadataCache,
  DidCache,
  DpopNonceCache,
  Fetch,
  HandleCache,
  HandleResolver,
  InternalStateData,
  Key,
  Keyset,
  OAuthClientMetadata,
  OAuthClientMetadataInput,
  OAuthResponseMode,
  ProtectedResourceMetadataCache,
  RuntimeImplementation,
  SessionStore,
  StateStore,
}

export type OAuthClientOptions = {
  // Config
  responseMode: OAuthResponseMode
  clientMetadata: Readonly<OAuthClientMetadataInput>
  keyset?: Keyset | Iterable<Key | undefined | null | false>

  // Stores
  stateStore: StateStore
  sessionStore: SessionStore
  didCache?: DidCache
  handleCache?: HandleCache
  authorizationServerMetadataCache?: AuthorizationServerMetadataCache
  protectedResourceMetadataCache?: ProtectedResourceMetadataCache
  dpopNonceCache?: DpopNonceCache

  // Services
  handleResolver: HandleResolver | URL | string
  plcDirectoryUrl?: URL | string
  runtimeImplementation: RuntimeImplementation
  fetch?: Fetch
}

export type OAuthClientEventMap = SessionEventMap

export type OAuthClientFetchMetadataOptions = {
  clientId: OAuthClientIdDiscoverable
  fetch?: Fetch
  signal?: AbortSignal
}

export class OAuthClient extends CustomEventTarget<OAuthClientEventMap> {
  static async fetchMetadata({
    clientId,
    fetch = globalThis.fetch,
    signal,
  }: OAuthClientFetchMetadataOptions) {
    signal?.throwIfAborted()

    const request = new Request(clientId, {
      redirect: 'error',
      signal: signal,
    })
    const response = await fetch(request)

    if (response.status !== 200) {
      response.body?.cancel?.()
      throw new TypeError(`Failed to fetch client metadata: ${response.status}`)
    }

    // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html#section-4.1
    const mime = response.headers.get('content-type')?.split(';')[0].trim()
    if (mime !== 'application/json') {
      response.body?.cancel?.()
      throw new TypeError(`Invalid client metadata content type: ${mime}`)
    }

    const json: unknown = await response.json()

    signal?.throwIfAborted()

    return oauthClientMetadataSchema.parse(json)
  }

  // Config
  readonly clientMetadata: ClientMetadata
  readonly responseMode: OAuthResponseMode
  readonly keyset?: Keyset

  // Services
  readonly runtime: Runtime
  readonly fetch: Fetch
  readonly oauthResolver: OAuthResolver
  readonly serverFactory: OAuthServerFactory

  // Stores
  readonly sessionGetter: SessionGetter
  readonly stateStore: StateStore

  constructor({
    fetch = globalThis.fetch,

    stateStore,
    sessionStore,

    didCache = undefined,
    dpopNonceCache = new SimpleStoreMemory({ ttl: 60e3, max: 100 }),
    handleCache = undefined,
    authorizationServerMetadataCache = new SimpleStoreMemory({
      ttl: 60e3,
      max: 100,
    }),
    protectedResourceMetadataCache = new SimpleStoreMemory({
      ttl: 60e3,
      max: 100,
    }),

    responseMode,
    clientMetadata,
    handleResolver,
    plcDirectoryUrl,
    runtimeImplementation,
    keyset,
  }: OAuthClientOptions) {
    super()

    this.keyset = keyset
      ? keyset instanceof Keyset
        ? keyset
        : new Keyset(keyset)
      : undefined
    this.clientMetadata = validateClientMetadata(clientMetadata, this.keyset)
    this.responseMode = responseMode

    this.runtime = new Runtime(runtimeImplementation)
    this.fetch = fetch
    this.oauthResolver = new OAuthResolver(
      new IdentityResolver(
        new DidResolverCached(
          new DidResolverCommon({ fetch, plcDirectoryUrl }),
          didCache,
        ),
        new CachedHandleResolver(
          AppViewHandleResolver.from(handleResolver, { fetch }),
          handleCache,
        ),
      ),
      new OAuthProtectedResourceMetadataResolver(
        protectedResourceMetadataCache,
        fetch,
      ),
      new OAuthAuthorizationServerMetadataResolver(
        authorizationServerMetadataCache,
        fetch,
      ),
    )
    this.serverFactory = new OAuthServerFactory(
      this.clientMetadata,
      this.runtime,
      this.oauthResolver,
      this.fetch,
      this.keyset,
      dpopNonceCache,
    )

    this.sessionGetter = new SessionGetter(
      sessionStore,
      this.serverFactory,
      this.runtime,
    )
    this.stateStore = stateStore

    // Proxy sessionGetter events
    for (const type of ['deleted', 'updated'] as const) {
      this.sessionGetter.addEventListener(type, (event) => {
        if (!this.dispatchCustomEvent(type, event.detail)) {
          event.preventDefault()
        }
      })
    }
  }

  // Exposed as public API for convenience
  get identityResolver() {
    return this.oauthResolver.identityResolver
  }

  // Exposed as public API for convenience
  get didResolver() {
    return this.identityResolver.didResolver
  }

  // Exposed as public API for convenience
  get handleResolver() {
    return this.identityResolver.handleResolver
  }

  get jwks() {
    return this.keyset?.publicJwks ?? ({ keys: [] as const } as const)
  }

  async authorize(input: string, options?: AuthorizeOptions): Promise<URL> {
    const redirectUri =
      options?.redirect_uri ?? this.clientMetadata.redirect_uris[0]
    if (!this.clientMetadata.redirect_uris.includes(redirectUri)) {
      // The server will enforce this, but let's catch it early
      throw new TypeError('Invalid redirect_uri')
    }

    const { identity, metadata } = await this.oauthResolver.resolve(
      input,
      options,
    )

    const nonce = await this.runtime.generateNonce()
    const pkce = await this.runtime.generatePKCE()
    const dpopKey = await this.runtime.generateKey(
      metadata.dpop_signing_alg_values_supported || [FALLBACK_ALG],
    )

    const state = await this.runtime.generateNonce()

    await this.stateStore.set(state, {
      iss: metadata.issuer,
      dpopKey,
      nonce,
      verifier: pkce?.verifier,
      appState: options?.state,
    })

    const parameters = {
      client_id: this.clientMetadata.client_id,
      redirect_uri: redirectUri,
      code_challenge: pkce?.challenge,
      code_challenge_method: pkce?.method,
      nonce,
      state,
      login_hint: identity
        ? input // If input is a handle or a DID, use it as a login_hint
        : undefined,
      response_mode: this.responseMode,
      response_type:
        // Negotiate by using the order in the client metadata
        this.clientMetadata.response_types?.find((t) =>
          metadata['response_types_supported']?.includes(t),
        ) ?? 'code',

      display: options?.display,
      id_token_hint: options?.id_token_hint,
      max_age: options?.max_age, // this.clientMetadata.default_max_age
      prompt: options?.prompt,
      scope: options?.scope
        ?.split(' ')
        .filter((s) => metadata.scopes_supported?.includes(s))
        .join(' '),
      ui_locales: options?.ui_locales,
    }

    if (metadata.pushed_authorization_request_endpoint) {
      const server = await this.serverFactory.fromMetadata(metadata, dpopKey)
      const parResponse = await server.request(
        'pushed_authorization_request',
        parameters,
      )

      const authorizationUrl = new URL(metadata.authorization_endpoint)
      authorizationUrl.searchParams.set(
        'client_id',
        this.clientMetadata.client_id,
      )
      authorizationUrl.searchParams.set('request_uri', parResponse.request_uri)
      return authorizationUrl
    } else if (metadata.require_pushed_authorization_requests) {
      throw new Error(
        'Server requires pushed authorization requests (PAR) but no PAR endpoint is available',
      )
    } else {
      const authorizationUrl = new URL(metadata.authorization_endpoint)
      for (const [key, value] of Object.entries(parameters)) {
        if (value) authorizationUrl.searchParams.set(key, String(value))
      }

      // Length of the URL that will be sent to the server
      const urlLength =
        authorizationUrl.pathname.length + authorizationUrl.search.length
      if (urlLength < 2048) {
        return authorizationUrl
      } else if (!metadata.pushed_authorization_request_endpoint) {
        throw new Error('Login URL too long')
      }
    }

    throw new Error(
      'Server does not support pushed authorization requests (PAR)',
    )
  }

  /**
   * This method allows the client to proactively revoke the request_uri it
   * created through PAR.
   */
  async abortRequest(authorizeUrl: URL) {
    const requestUri = authorizeUrl.searchParams.get('request_uri')
    if (!requestUri) return

    // @NOTE This is not implemented here because, 1) the request server should
    // invalidate the request_uri after some delay anyways, and 2) I am not sure
    // that the revocation endpoint is even supposed to support this (and I
    // don't want to spend the time checking now).

    // @TODO investigate actual necessity & feasibility of this feature
  }

  async callback(params: URLSearchParams): Promise<{
    session: OAuthSession
    state: string | null
  }> {
    const responseJwt = params.get('response')
    if (responseJwt != null) {
      // https://openid.net/specs/oauth-v2-jarm.html
      throw new OAuthCallbackError(params, 'JARM not supported')
    }

    const issuerParam = params.get('iss')
    const stateParam = params.get('state')
    const errorParam = params.get('error')
    const codeParam = params.get('code')

    if (!stateParam) {
      throw new OAuthCallbackError(params, 'Missing "state" parameter')
    }
    const stateData = await this.stateStore.get(stateParam)
    if (stateData) {
      // Prevent any kind of replay
      await this.stateStore.del(stateParam)
    } else {
      throw new OAuthCallbackError(
        params,
        `Unknown authorization session "${stateParam}"`,
      )
    }

    try {
      if (errorParam != null) {
        throw new OAuthCallbackError(params, undefined, stateData.appState)
      }

      if (!codeParam) {
        throw new OAuthCallbackError(
          params,
          'Missing "code" query param',
          stateData.appState,
        )
      }

      const server = await this.serverFactory.fromIssuer(
        stateData.iss,
        stateData.dpopKey,
      )

      if (issuerParam != null) {
        if (!server.serverMetadata.issuer) {
          throw new OAuthCallbackError(
            params,
            'Issuer not found in metadata',
            stateData.appState,
          )
        }
        if (server.serverMetadata.issuer !== issuerParam) {
          throw new OAuthCallbackError(
            params,
            'Issuer mismatch',
            stateData.appState,
          )
        }
      } else if (
        server.serverMetadata.authorization_response_iss_parameter_supported
      ) {
        throw new OAuthCallbackError(
          params,
          'iss missing from the response',
          stateData.appState,
        )
      }

      const tokenSet = await server.exchangeCode(codeParam, stateData.verifier)
      try {
        if (tokenSet.id_token) {
          await this.runtime.validateIdTokenClaims(
            tokenSet.id_token,
            stateParam,
            stateData.nonce,
            codeParam,
            tokenSet.access_token,
          )
        }

        const { sub } = tokenSet

        await this.sessionGetter.setStored(sub, {
          dpopKey: stateData.dpopKey,
          tokenSet,
        })

        const session = this.createSession(server, sub)

        return { session, state: stateData.appState ?? null }
      } catch (err) {
        await server.revoke(tokenSet.access_token)

        throw err
      }
    } catch (err) {
      // Make sure, whatever the underlying error, that the appState is
      // available in the calling code
      throw OAuthCallbackError.from(err, params, stateData.appState)
    }
  }

  /**
   * Load a stored session. This will refresh the token only if needed (about to
   * expire) by default.
   *
   * @param refresh See {@link SessionGetter.getSession}
   */
  async restore(sub: string, refresh?: boolean): Promise<OAuthSession> {
    const { dpopKey, tokenSet } = await this.sessionGetter.getSession(
      sub,
      refresh,
    )

    const server = await this.serverFactory.fromIssuer(tokenSet.iss, dpopKey, {
      noCache: refresh === true,
      allowStale: refresh === false,
    })

    return this.createSession(server, sub)
  }

  async revoke(sub: string) {
    const { dpopKey, tokenSet } = await this.sessionGetter.getSession(
      sub,
      false,
    )

    // NOT using `;(await this.restore(sub, false)).signOut()` because we want
    // the tokens to be deleted even if it was not possible to fetch the issuer
    // data.
    try {
      const server = await this.serverFactory.fromIssuer(tokenSet.iss, dpopKey)
      await server.revoke(tokenSet.access_token)
    } finally {
      await this.sessionGetter.delStored(sub, new TokenRevokedError(sub))
    }
  }

  protected createSession(server: OAuthServerAgent, sub: string): OAuthSession {
    return new OAuthSession(server, sub, this.sessionGetter, this.fetch)
  }
}
