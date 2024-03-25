import { GenericStore, MemoryStore } from '@atproto/caching'
import { Key, Keyset } from '@atproto/jwk'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'

import { FALLBACK_ALG } from './constants.js'
import { CryptoImplementation } from './crypto-implementation.js'
import { CryptoWrapper } from './crypto-wrapper.js'
import { OAuthResolver, OAuthResolverOptions } from './oauth-resolver.js'
import { OAuthServer, TokenSet } from './oauth-server.js'
import { OAuthAuthorizeOptions } from './oauth-types.js'
import { validateClientMetadata } from './validate-client-metadata.js'

export type Session = {
  dpopKey: Key
  tokenSet: TokenSet
}

export type InternalStateData = {
  iss: string
  nonce: string
  dpopKey: Key
  verifier?: string
  appState?: string
}

export type ClientConfig = {
  /**
   * "form_post" will typically be used for server-side applications.
   */
  responseMode?: 'query' | 'fragment' | 'form_post'
  responseType?: 'code' | 'code id_token'
}

export type OAuthClientOptions = OAuthResolverOptions & {
  clientMetadata: OAuthClientMetadata
  keyset?: Keyset
  crypto: CryptoImplementation
  stateStore: GenericStore<string, InternalStateData>
  sessionStore: GenericStore<string, Session>
  config?: ClientConfig
  dpopNonceCache?: GenericStore<string, string>
}

export function oauthClientFactory({
  clientMetadata,
  stateStore,
  sessionStore,

  crypto: cryptoImplementation,
  keyset,
  config,
  fetch = globalThis.fetch,
  dpopNonceCache = new MemoryStore<string, string>({
    ttl: 60e3,
    max: 100,
  }),

  ...resolverOptions
}: OAuthClientOptions) {
  validateClientMetadata(clientMetadata, keyset)

  const crypto = new CryptoWrapper(cryptoImplementation)
  const resolver = OAuthResolver.from({ fetch, ...resolverOptions })

  const buildServer = (serverMetadata: OAuthServerMetadata, dpopKey: Key) =>
    new OAuthServer(
      clientMetadata,
      serverMetadata,
      dpopKey,
      dpopNonceCache,
      resolver,
      crypto,
      keyset,
      fetch,
    )

  return class OAuthClient {
    static async authorize(
      input: string,
      options?: OAuthAuthorizeOptions,
    ): Promise<URL> {
      const { did, metadata } = await resolver.resolve(input)

      const nonce = await crypto.generateNonce()
      const pkce = await crypto.generatePKCE()
      const dpopKey = await crypto.generateKey(
        metadata.dpop_signing_alg_values_supported || [FALLBACK_ALG],
      )

      const state = await crypto.generateNonce()

      await stateStore.set(state, {
        iss: metadata.issuer,
        dpopKey,
        nonce,
        verifier: pkce?.verifier,
        appState: options?.state,
      })

      const parameters = {
        client_id: clientMetadata.client_id,
        redirect_uri: clientMetadata.redirect_uris[0],
        code_challenge: pkce?.challenge,
        code_challenge_method: pkce?.method,
        nonce,
        state,
        login_hint: did,
        response_mode: config?.responseMode,
        response_type:
          config?.responseType != null &&
          metadata['response_types_supported']?.includes(config?.responseType)
            ? config.responseType
            : 'code',

        display: options?.display,
        id_token_hint: options?.id_token_hint,
        max_age: options?.max_age, // clientMetadata.default_max_age
        prompt: options?.prompt,
        scope: options?.scope,
        ui_locales: options?.ui_locales,
      }

      if (metadata.pushed_authorization_request_endpoint) {
        const server = buildServer(metadata, dpopKey)
        const { json } = await server.request(
          'pushed_authorization_request',
          parameters,
        )

        const authorizationUrl = new URL(metadata.authorization_endpoint)
        authorizationUrl.searchParams.set('client_id', clientMetadata.client_id)
        authorizationUrl.searchParams.set('request_uri', json.request_uri)
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

    static async callback(params: URLSearchParams): Promise<{
      sessionId: string
      client: OAuthClient
      state?: string
    }> {
      // TODO: better errors

      const state = params.get('state')
      if (!state) throw new TypeError('"state" parameter missing')

      const stateData = await stateStore.get(state)
      if (!stateData) throw new TypeError('Invalid state')
      else await stateStore.delete(state)

      const metadata = await resolver.resolveOAuthMetadata(stateData.iss)
      const server = buildServer(metadata, stateData.dpopKey)

      if (params.get('response') != null) {
        throw new TypeError('JARM not implemented')
      }

      const issuer = params.get('iss')
      if (issuer != null) {
        if (!metadata.issuer)
          throw new TypeError('Issuer not found in metadata')
        if (metadata.issuer !== issuer) {
          throw new TypeError('Issuer mismatch')
        }
      } else if (metadata.authorization_response_iss_parameter_supported) {
        throw new TypeError('iss missing from the response')
      }

      const error = params.get('error')
      const code = params.get('code')

      const error_description = params.get('error_description')
      if (error != null || error_description != null || !code) {
        // TODO: provide a proper way for the calling fn to read the error (e.g.
        // "login_required", etc.)
        const message =
          error || error_description || 'Unexpected empty "error" parameter'
        throw new TypeError(message)
      }

      const tokenSet = await server.exchangeCode(code, stateData.verifier)

      try {
        // OpenID checks
        if (tokenSet.id_token) {
          await crypto.validateIdTokenClaims(
            tokenSet.id_token,
            state,
            stateData.nonce,
            code,
            tokenSet.access_token,
          )
        }

        const sessionId = await crypto.generateNonce(4)
        await sessionStore.set(sessionId, {
          dpopKey: stateData.dpopKey,
          tokenSet,
        })

        const client = new OAuthClient(server, sessionId, tokenSet)

        return { sessionId, client, state: stateData.appState }
      } catch (err) {
        const token = tokenSet.refresh_token || tokenSet.access_token
        await server.revoke(token)

        throw err
      }
    }

    static async restore(sessionId: string): Promise<OAuthClient> {
      const data = await sessionStore.get(sessionId)
      if (!data) throw new Error('Session not found')

      const metadata = await resolver.resolveOAuthMetadata(data.tokenSet.iss)

      const server = buildServer(metadata, data.dpopKey)

      // Make sure the token is still valid & that the authority is still the same
      const tokenSet = await server.refresh(data.tokenSet)
      await sessionStore.set(sessionId, {
        dpopKey: data.dpopKey,
        tokenSet,
      })

      return new OAuthClient(server, sessionId, tokenSet)
    }

    static async revoke(sessionId: string) {
      const data = await sessionStore.get(sessionId)
      if (!data) throw new Error('Session not found')

      const metadata = await resolver.resolveOAuthMetadata(data.tokenSet.iss)
      const server = buildServer(metadata, data.dpopKey)

      await server.revoke(data.tokenSet.access_token)
      await sessionStore.delete(sessionId)
    }

    protected constructor(
      public server: OAuthServer,
      public sessionId: string,
      public tokenSet: TokenSet,
    ) {}

    async getAuth(refresh = Date.now() > this.tokenSet.expires_at) {
      if (refresh) {
        this.tokenSet = await this.server.refresh(this.tokenSet)
        await sessionStore.set(this.sessionId, {
          dpopKey: this.server.dpopKey,
          tokenSet: this.tokenSet,
        })
      }

      return {
        aud: this.tokenSet.aud,
        header: `${this.tokenSet.token_type} ${this.tokenSet.access_token}`,
      }
    }

    async request(pathname: string, init?: RequestInit): Promise<Response> {
      const { header, aud } = await this.getAuth()
      const headers = new Headers(init?.headers)
      headers.set('Authorization', header)
      const request = new Request(new URL(pathname, aud), { ...init, headers })
      return this.server.dpopFetch(request)
    }
  }
}
