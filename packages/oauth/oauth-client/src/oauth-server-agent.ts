import { AtprotoDid } from '@atproto/did'
import { Key, Keyset } from '@atproto/jwk'
import {
  OAuthAuthorizationRequestPar,
  OAuthAuthorizationServerMetadata,
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
import { TokenRefreshError } from './errors/token-refresh-error.js'
import { dpopFetchWrapper } from './fetch-dpop.js'
import {
  ClientAuthMethod,
  ClientCredentialsFactory,
  createClientCredentialsFactory,
} from './oauth-client-auth.js'
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
  protected clientCredentialsFactory: ClientCredentialsFactory

  /**
   * @throws see {@link createClientCredentialsFactory}
   */
  constructor(
    readonly authMethod: ClientAuthMethod,
    readonly dpopKey: Key,
    readonly serverMetadata: OAuthAuthorizationServerMetadata,
    readonly clientMetadata: ClientMetadata,
    readonly dpopNonces: DpopNonceCache,
    readonly oauthResolver: OAuthResolver,
    readonly runtime: Runtime,
    readonly keyset?: Keyset,
    fetch?: Fetch,
  ) {
    this.clientCredentialsFactory = createClientCredentialsFactory(
      authMethod,
      serverMetadata,
      clientMetadata,
      runtime,
      keyset,
    )

    this.dpopFetch = dpopFetchWrapper<void>({
      fetch: bindFetch(fetch),
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
  protected async verifyIssuer(sub: AtprotoDid): Promise<string> {
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

    return resolved.pds.href
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

    const auth = await this.clientCredentialsFactory()

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-3.2.2
    // https://datatracker.ietf.org/doc/html/rfc7009#section-2.1
    // https://datatracker.ietf.org/doc/html/rfc7662#section-2.1
    // https://datatracker.ietf.org/doc/html/rfc9126#section-2
    const { response, json } = await this.dpopFetch(url, {
      method: 'POST',
      headers: {
        ...auth.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: wwwFormUrlEncode({ ...payload, ...auth.payload }),
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
}

function wwwFormUrlEncode(payload: Record<string, undefined | unknown>) {
  return new URLSearchParams(
    Object.entries(payload)
      .filter(entryHasDefinedValue)
      .map(stringifyEntryValue),
  ).toString()
}

function entryHasDefinedValue(
  entry: [string, unknown],
): entry is [string, null | NonNullable<unknown>] {
  return entry[1] !== undefined
}

function stringifyEntryValue(entry: [string, unknown]): [string, string] {
  const name = entry[0]
  const value = entry[1]

  switch (typeof value) {
    case 'string':
      return [name, value]
    case 'number':
    case 'boolean':
      return [name, String(value)]
    default: {
      const enc = JSON.stringify(value)
      if (enc === undefined) {
        throw new Error(`Unsupported value type for ${name}: ${String(value)}`)
      }
      return [name, enc]
    }
  }
}
