import { AtprotoDid } from '@atproto/did'
import { Key, Keyset } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationRequestPar,
  OAuthAuthorizationServerMetadata,
  OAuthClientCredentials,
  OAuthEndpointName,
  OAuthParResponse,
  OAuthTokenRequest,
  oauthParResponseSchema,
} from '@atproto/oauth-types'
import { Fetch, Json, bindFetch, fetchJsonProcessor } from '@atproto-labs/fetch'
import { SimpleStore } from '@atproto-labs/simple-store'
import {
  AtprotoScope,
  AtprotoTokenResponse,
  atprotoTokenResponseSchema,
} from './atproto-token-response.js'
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
  sub: AtprotoDid
  aud: string
  scope: AtprotoScope

  refresh_token?: string
  access_token: string
  token_type: 'DPoP'
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

  get issuer() {
    return this.serverMetadata.issuer
  }

  async revoke(token: string) {
    try {
      await this.request('revocation', { token })
    } catch {
      // Don't care
    }
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenSet> {
    const now = Date.now()

    const tokenResponse = await this.request('token', {
      grant_type: 'authorization_code',
      redirect_uri: this.clientMetadata.redirect_uris[0]!,
      code,
      code_verifier: codeVerifier,
    })

    try {
      // /!\ IMPORTANT /!\
      //
      // The tokenResponse MUST always be valid before the "sub" it contains
      // can be trusted (see Atproto's OAuth spec for details).
      const aud = await this.verifyIssuer(tokenResponse.sub)

      return {
        aud,
        sub: tokenResponse.sub,
        iss: this.issuer,

        scope: tokenResponse.scope,
        refresh_token: tokenResponse.refresh_token,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,

        expires_at:
          typeof tokenResponse.expires_in === 'number'
            ? new Date(now + tokenResponse.expires_in * 1000).toISOString()
            : undefined,
      }
    } catch (err) {
      await this.revoke(tokenResponse.access_token)

      throw err
    }
  }

  async refresh(tokenSet: TokenSet): Promise<TokenSet> {
    if (!tokenSet.refresh_token) {
      throw new TokenRefreshError(tokenSet.sub, 'No refresh token available')
    }

    // /!\ IMPORTANT /!\
    //
    // The "sub" MUST be a DID, whose issuer authority is indeed the server we
    // are trying to obtain credentials from. Note that we are doing this
    // *before* we actually try to refresh the token:
    // 1) To avoid unnecessary refresh
    // 2) So that the refresh is the last async operation, ensuring as few
    //    async operations happen before the result gets a chance to be stored.
    const aud = await this.verifyIssuer(tokenSet.sub)

    const now = Date.now()

    const tokenResponse = await this.request('token', {
      grant_type: 'refresh_token',
      refresh_token: tokenSet.refresh_token,
    })

    return {
      aud,
      sub: tokenSet.sub,
      iss: this.issuer,

      scope: tokenResponse.scope,
      refresh_token: tokenResponse.refresh_token,
      access_token: tokenResponse.access_token,
      token_type: tokenResponse.token_type,

      expires_at:
        typeof tokenResponse.expires_in === 'number'
          ? new Date(now + tokenResponse.expires_in * 1000).toISOString()
          : undefined,
    }
  }

  /**
   * VERY IMPORTANT ! Always call this to process token responses.
   *
   * Whenever an OAuth token response is received, we **MUST** verify that the
   * "sub" is a DID, whose issuer authority is indeed the server we just
   * obtained credentials from. This check is a critical step to actually be
   * able to use the "sub" (DID) as being the actual user's identifier.
   *
   * @returns The user's PDS URL (the resource server for the user)
   */
  protected async verifyIssuer(sub: AtprotoDid) {
    using signal = timeoutSignal(10e3)

    const resolved = await this.oauthResolver.resolveFromIdentity(sub, {
      noCache: true,
      allowStale: false,
      signal,
    })

    if (this.issuer !== resolved.metadata.issuer) {
      // Best case scenario; the user switched PDS. Worst case scenario; a bad
      // actor is trying to impersonate a user. In any case, we must not allow
      // this token to be used.
      throw new TypeError('Issuer mismatch')
    }

    return resolved.identity.pds.href
  }

  async request<Endpoint extends OAuthEndpointName>(
    endpoint: Endpoint,
    payload: Endpoint extends 'token'
      ? OAuthTokenRequest
      : Endpoint extends 'pushed_authorization_request'
        ? OAuthAuthorizationRequestPar
        : Record<string, unknown>,
  ): Promise<
    Endpoint extends 'token'
      ? AtprotoTokenResponse
      : Endpoint extends 'pushed_authorization_request'
        ? OAuthParResponse
        : Json
  >
  async request(
    endpoint: OAuthEndpointName,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
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
          return atprotoTokenResponseSchema.parse(json)
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
    payload: OAuthClientCredentials
  }> {
    const methodSupported =
      this.serverMetadata[`token_endpoint_auth_methods_supported`]

    const method = this.clientMetadata[`token_endpoint_auth_method`]

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
            `token_endpoint_auth_signing_alg_values_supported`
          ] ?? FALLBACK_ALG

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
