import { GenericStore } from '@atproto/caching'
import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchOkProcessor,
} from '@atproto/fetch'
import { dpopFetchWrapper } from '@atproto/fetch-dpop'
import { Jwt, Key, Keyset } from '@atproto/jwk'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'
import { FALLBACK_ALG } from './constants.js'
import { CryptoWrapper } from './crypto-wrapper.js'
import { OAuthResolver } from './oauth-resolver.js'
import {
  OAuthEndpointName,
  OAuthTokenResponse,
  OAuthTokenType,
} from './oauth-types.js'

export type TokenSet = {
  iss: string
  sub: string
  aud: string
  scope?: string

  id_token?: Jwt
  refresh_token?: string
  access_token: string
  token_type: OAuthTokenType
  expires_at: number
}

export class OAuthServer {
  readonly dpopFetch: (request: Request) => Promise<Response>

  constructor(
    readonly clientMetadata: OAuthClientMetadata & { client_id: string },
    readonly serverMetadata: OAuthServerMetadata,
    readonly dpopKey: Key,
    readonly dpopNonceCache: GenericStore<string, string>,
    readonly resolver: OAuthResolver,
    readonly crypto: CryptoWrapper,
    readonly keyset?: Keyset,
    fetch?: Fetch,
  ) {
    const dpopFetch = dpopFetchWrapper({
      fetch,
      iss: this.clientMetadata.client_id,
      key: dpopKey,
      alg: negotiateAlg(
        dpopKey,
        serverMetadata.dpop_signing_alg_values_supported,
      ),
      sha256: async (v) => crypto.sha256(v),
      nonceCache: dpopNonceCache,
    })

    this.dpopFetch = (request) => dpopFetch(request).catch(fetchFailureHandler)
  }

  public async revoke(token: string) {
    try {
      await this.request('revocation', { token })
    } catch {
      // Don't care
    }
  }

  public async exchangeCode(
    code: string,
    verifier?: string,
  ): Promise<TokenSet> {
    const { json: tokenResponse } = await this.request('token', {
      grant_type: 'authorization_code',
      redirect_uri: this.clientMetadata.redirect_uris[0]!,
      code,
      code_verifier: verifier,
    })

    try {
      if (!tokenResponse.sub) {
        throw new TypeError(`Unexpected "sub" in token response`)
      }

      // IMPORTANT: We **MUST** verify that the "sub" is indeed a DID, and that
      // the issuer authority is indeed the current server.

      const resolved = await this.resolver.resolve(tokenResponse.sub)
      if (resolved.did !== tokenResponse.sub) {
        // `sub` should already be a DID though, but we can never really trust
        // the server to return the correct value
        throw new TypeError(`No DID found for ${tokenResponse.sub}`)
      }

      if (resolved.metadata.issuer !== this.serverMetadata.issuer) {
        // Did the DID migrate to another server?
        throw new TypeError('Issuer mismatch')
      }

      return {
        sub: tokenResponse.sub,
        aud: resolved.pds.href,
        iss: resolved.metadata.issuer,

        id_token: tokenResponse.id_token,
        refresh_token: tokenResponse.refresh_token,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type ?? 'Bearer',
        expires_at: Date.now() + (tokenResponse.expires_in ?? 60) * 1000,
      }
    } catch (err) {
      const token = tokenResponse.refresh_token || tokenResponse.access_token
      if (token) await this.revoke(token)

      throw err
    }
  }

  public async refresh(tokenSet: TokenSet): Promise<TokenSet> {
    if (!tokenSet.refresh_token) {
      throw new Error('No refresh token available')
    }

    const { json: tokenResponse } = await this.request('token', {
      grant_type: 'refresh_token',
      refresh_token: tokenSet.refresh_token,
    })

    try {
      if (tokenResponse.sub !== tokenSet.sub) {
        throw new TypeError(`Unexpected "sub" in token response`)
      }

      const resolved = await this.resolver.resolve(tokenResponse.sub)
      if (resolved.did !== tokenResponse.sub) {
        throw new TypeError(`No DID found for ${tokenResponse.sub}`)
      }

      if (resolved.metadata.issuer !== tokenSet.iss) {
        throw new TypeError('Issuer mismatch')
      }

      if (resolved.metadata.issuer !== this.serverMetadata.issuer) {
        throw new TypeError('Issuer mismatch')
      }

      return {
        sub: tokenResponse.sub,
        aud: resolved.pds.href,
        iss: resolved.metadata.issuer,

        id_token: tokenResponse.id_token,
        refresh_token: tokenResponse.refresh_token,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type ?? 'Bearer',
        expires_at: Date.now() + (tokenResponse.expires_in ?? 60) * 1000,
      }
    } catch (err) {
      const token = tokenResponse.refresh_token || tokenResponse.access_token
      if (token) await this.revoke(token)

      throw err
    }
  }

  public async request<E extends OAuthEndpointName>(
    endpoint: E,
    payload: Record<string, unknown>,
  ) {
    const url = this.serverMetadata[`${endpoint}_endpoint`]
    if (!url) throw new Error(`No ${endpoint} endpoint available`)
    const auth = await this.buildClientAuth(endpoint)

    const request = new Request(url, {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...auth.payload }),
    })

    const response = await this.dpopFetch(request)
      .then(fetchOkProcessor())
      .then(
        fetchJsonProcessor<
          E extends 'pushed_authorization_request'
            ? { request_uri: string }
            : E extends 'token'
            ? OAuthTokenResponse
            : unknown
        >(),
      )

    // TODO: validate using zod ?
    if (endpoint === 'token') {
      if (!response.json['access_token']) {
        throw new TypeError('No access token in token response')
      }
    }

    return response
  }

  protected async buildClientAuth(endpoint: OAuthEndpointName): Promise<{
    headers?: Record<string, string>
    payload:
      | {
          client_id: string
        }
      | {
          client_id: string
          client_assertion_type: string
          client_assertion: string
        }
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
          .filter((v): v is string => !!v)

        return {
          payload: {
            client_id: this.clientMetadata.client_id,
            client_assertion_type:
              'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: await this.keyset.sign(
              { alg, kid },
              {
                iss: this.clientMetadata.client_id,
                sub: this.clientMetadata.client_id,
                aud: this.serverMetadata.issuer,
                jti: await this.crypto.generateNonce(),
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

function negotiateAlg(key: Key, supportedAlgs: string[] | undefined): string {
  const alg = key.algorithms.find((a) => supportedAlgs?.includes(a) ?? true)
  if (alg) return alg

  throw new Error('Key does not match any alg supported by the server')
}
