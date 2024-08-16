import { Fetch, Json, bindFetch, fetchJsonProcessor } from '@atproto-labs/fetch'
import { SimpleStore } from '@atproto-labs/simple-store'
import { Key, Keyset, SignedJwt } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationServerMetadata,
  OAuthClientIdentification,
  OAuthEndpointName,
  OAuthParResponse,
  OAuthTokenResponse,
  OAuthTokenType,
  oauthParResponseSchema,
  oauthTokenResponseSchema,
} from '@atproto/oauth-types'

import { FALLBACK_ALG } from './constants.js'
import { TokenRefreshError } from './errors/token-refresh-error.js'
import { dpopFetchWrapper } from './fetch-dpop.js'
import { OAuthResolver } from './oauth-resolver.js'
import { OAuthResponseError } from './oauth-response-error.js'
import { Runtime } from './runtime.js'
import { ClientMetadata } from './types.js'
import { timeoutSignal } from './util.js'

export type TokenSet = {
  iss: string
  sub: string
  aud: string
  scope?: string

  id_token?: SignedJwt
  refresh_token?: string
  access_token: string
  token_type: OAuthTokenType
  /** ISO Date */
  expires_at?: string
}

export type DpopNonceCache = SimpleStore<string, string>

export class OAuthServerAgent {
  protected dpopFetch: Fetch<unknown>

  constructor(
    readonly dpopKey: Key,
    readonly serverMetadata: OAuthAuthorizationServerMetadata,
    readonly clientMetadata: ClientMetadata,
    readonly dpopNonces: DpopNonceCache,
    readonly oauthResolver: OAuthResolver,
    readonly runtime: Runtime,
    readonly keyset?: Keyset,
    fetch?: Fetch,
  ) {
    this.dpopFetch = dpopFetchWrapper<void>({
      fetch: bindFetch(fetch),
      iss: clientMetadata.client_id,
      key: dpopKey,
      supportedAlgs: serverMetadata.dpop_signing_alg_values_supported,
      sha256: async (v) => runtime.sha256(v),
      nonces: dpopNonces,
      isAuthServer: true,
    })
  }

  async revoke(token: string) {
    try {
      await this.request('revocation', { token })
    } catch {
      // Don't care
    }
  }

  async exchangeCode(code: string, verifier?: string): Promise<TokenSet> {
    const tokenResponse = await this.request('token', {
      grant_type: 'authorization_code',
      redirect_uri: this.clientMetadata.redirect_uris[0]!,
      code,
      code_verifier: verifier,
    })

    try {
      return this.processTokenResponse(tokenResponse)
    } catch (err) {
      await this.revoke(tokenResponse.access_token)

      throw err
    }
  }

  async refresh(tokenSet: TokenSet): Promise<TokenSet> {
    if (!tokenSet.refresh_token) {
      throw new TokenRefreshError(tokenSet.sub, 'No refresh token available')
    }

    const tokenResponse = await this.request('token', {
      grant_type: 'refresh_token',
      refresh_token: tokenSet.refresh_token,
    })

    try {
      if (tokenSet.sub !== tokenResponse.sub) {
        throw new TokenRefreshError(
          tokenSet.sub,
          `Unexpected "sub" in token response (${tokenResponse.sub})`,
        )
      }
      if (tokenSet.iss !== this.serverMetadata.issuer) {
        throw new TokenRefreshError(tokenSet.sub, 'Issuer mismatch')
      }

      return this.processTokenResponse(tokenResponse)
    } catch (err) {
      await this.revoke(tokenResponse.access_token)

      throw err
    }
  }

  /**
   * VERY IMPORTANT ! Always call this to process token responses.
   *
   * Whenever an OAuth token response is received, we **MUST** verify that the
   * "sub" is a DID, whose issuer authority is indeed the server we just
   * obtained credentials from. This check is a critical step to actually be
   * able to use the "sub" (DID) as being the actual user's identifier.
   */
  private async processTokenResponse(
    tokenResponse: OAuthTokenResponse,
  ): Promise<TokenSet> {
    const { sub } = tokenResponse
    // ATPROTO requires that the "sub" is always present in the token response.
    if (!sub) throw new TypeError(`Missing "sub" in token response`)

    // @TODO (?) make timeout configurable
    using signal = timeoutSignal(10e3)

    const resolved = await this.oauthResolver.resolveFromIdentity(sub, {
      signal,
    })

    if (resolved.metadata.issuer !== this.serverMetadata.issuer) {
      // Best case scenario; the user switched PDS. Worst case scenario; a bad
      // actor is trying to impersonate a user. In any case, we must not allow
      // this token to be used.
      throw new TypeError('Issuer mismatch')
    }

    return {
      sub,
      aud: resolved.identity.pds.href,
      iss: resolved.metadata.issuer,

      scope: tokenResponse.scope,
      id_token: tokenResponse.id_token,
      refresh_token: tokenResponse.refresh_token,
      access_token: tokenResponse.access_token,
      token_type: tokenResponse.token_type ?? 'Bearer',
      expires_at:
        typeof tokenResponse.expires_in === 'number'
          ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
          : undefined,
    }
  }

  async request(
    endpoint: 'token',
    payload: Record<string, unknown>,
  ): Promise<OAuthTokenResponse>
  async request(
    endpoint: 'pushed_authorization_request',
    payload: Record<string, unknown>,
  ): Promise<OAuthParResponse>
  async request(
    endpoint: OAuthEndpointName,
    payload: Record<string, unknown>,
  ): Promise<Json>

  async request(endpoint: OAuthEndpointName, payload: Record<string, unknown>) {
    const url = this.serverMetadata[`${endpoint}_endpoint`]
    if (!url) throw new Error(`No ${endpoint} endpoint available`)

    const auth = await this.buildClientAuth(endpoint)

    const { response, json } = await this.dpopFetch(url, {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...auth.payload }),
    }).then(fetchJsonProcessor())

    if (response.ok) {
      switch (endpoint) {
        case 'token':
          return oauthTokenResponseSchema.parse(json)
        case 'pushed_authorization_request':
          return oauthParResponseSchema.parse(json)
        default:
          return json
      }
    } else {
      throw new OAuthResponseError(response, json)
    }
  }

  async buildClientAuth(endpoint: OAuthEndpointName): Promise<{
    headers?: Record<string, string>
    payload: OAuthClientIdentification
  }> {
    const methodSupported =
      this.serverMetadata[`${endpoint}_endpoint_auth_methods_supported`] ||
      this.serverMetadata[`token_endpoint_auth_methods_supported`]

    const method =
      this.clientMetadata[`${endpoint}_endpoint_auth_method`] ||
      this.clientMetadata[`token_endpoint_auth_method`]

    if (
      method === 'private_key_jwt' ||
      (this.keyset &&
        !method &&
        (methodSupported?.includes('private_key_jwt') ?? false))
    ) {
      if (!this.keyset) throw new Error('No keyset available')

      try {
        const alg =
          this.serverMetadata[
            `${endpoint}_endpoint_auth_signing_alg_values_supported`
          ] ??
          this.serverMetadata[
            `token_endpoint_auth_signing_alg_values_supported`
          ] ??
          FALLBACK_ALG

        // If jwks is defined, make sure to only sign using a key that exists in
        // the jwks. If jwks_uri is defined, we can't be sure that the key we're
        // looking for is in there so we will just assume it is.
        const kid = this.clientMetadata.jwks?.keys
          .map(({ kid }) => kid)
          .filter((v): v is string => typeof v === 'string')

        return {
          payload: {
            client_id: this.clientMetadata.client_id,
            client_assertion_type: CLIENT_ASSERTION_TYPE_JWT_BEARER,
            client_assertion: await this.keyset.createJwt(
              { alg, kid },
              {
                iss: this.clientMetadata.client_id,
                sub: this.clientMetadata.client_id,
                aud: this.serverMetadata.issuer,
                jti: await this.runtime.generateNonce(),
                iat: Math.floor(Date.now() / 1000),
              },
            ),
          },
        }
      } catch (err) {
        if (method === 'private_key_jwt') throw err

        // Else try next method
      }
    }

    if (
      method === 'none' ||
      (!method && (methodSupported?.includes('none') ?? true))
    ) {
      return {
        payload: {
          client_id: this.clientMetadata.client_id,
        },
      }
    }

    throw new Error(`Unsupported ${endpoint} authentication method`)
  }
}
