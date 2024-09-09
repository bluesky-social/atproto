import { asDid } from '@atproto/did'
import { Fetch, bindFetch } from '@atproto-labs/fetch'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'

import { TokenInvalidError } from './errors/token-invalid-error.js'
import { TokenRevokedError } from './errors/token-revoked-error.js'
import { dpopFetchWrapper } from './fetch-dpop.js'
import { OAuthServerAgent, TokenSet } from './oauth-server-agent.js'
import { SessionGetter } from './session-getter.js'

const ReadableStream = globalThis.ReadableStream as
  | typeof globalThis.ReadableStream
  | undefined

export type TokenInfo = {
  expiresAt?: Date
  expired?: boolean
  scope?: string
  iss: string
  aud: string
  sub: string
}

export class OAuthSession {
  protected dpopFetch: Fetch<unknown>

  constructor(
    public readonly server: OAuthServerAgent,
    public readonly sub: string,
    private readonly sessionGetter: SessionGetter,
    fetch: Fetch = globalThis.fetch,
  ) {
    this.dpopFetch = dpopFetchWrapper<void>({
      fetch: bindFetch(fetch),
      iss: server.clientMetadata.client_id,
      key: server.dpopKey,
      supportedAlgs: server.serverMetadata.dpop_signing_alg_values_supported,
      sha256: async (v) => server.runtime.sha256(v),
      nonces: server.dpopNonces,
      isAuthServer: false,
    })
  }

  get did() {
    return asDid(this.sub)
  }

  get serverMetadata(): Readonly<OAuthAuthorizationServerMetadata> {
    return this.server.serverMetadata
  }

  /**
   * @param refresh See {@link SessionGetter.getSession}
   */
  public async getTokenSet(refresh?: boolean): Promise<TokenSet> {
    const { tokenSet } = await this.sessionGetter.getSession(this.sub, refresh)
    return tokenSet
  }

  async getTokenInfo(refresh?: boolean): Promise<TokenInfo> {
    const tokenSet = await this.getTokenSet(refresh)
    const expiresAt =
      tokenSet.expires_at == null ? undefined : new Date(tokenSet.expires_at)

    return {
      expiresAt,
      get expired() {
        return expiresAt == null
          ? undefined
          : expiresAt.getTime() < Date.now() - 5e3
      },
      scope: tokenSet.scope,
      iss: tokenSet.iss,
      aud: tokenSet.aud,
      sub: tokenSet.sub,
    }
  }

  async signOut(): Promise<void> {
    try {
      const { tokenSet } = await this.sessionGetter.getSession(this.sub, false)
      await this.server.revoke(tokenSet.access_token)
    } finally {
      await this.sessionGetter.delStored(
        this.sub,
        new TokenRevokedError(this.sub),
      )
    }
  }

  async fetchHandler(pathname: string, init?: RequestInit): Promise<Response> {
    // This will try and refresh the token if it is known to be expired
    const tokenSet = await this.getTokenSet(undefined)

    const initialUrl = new URL(pathname, tokenSet.aud)
    const initialAuth = `${tokenSet.token_type} ${tokenSet.access_token}`

    const headers = new Headers(init?.headers)
    headers.set('Authorization', initialAuth)

    const initialResponse = await this.dpopFetch(initialUrl, {
      ...init,
      headers,
    })

    // If the token is not expired, we don't need to refresh it
    if (!isInvalidTokenResponse(initialResponse)) {
      return initialResponse
    }

    let tokenSetFresh: TokenSet
    try {
      // Force a refresh
      tokenSetFresh = await this.getTokenSet(true)
    } catch (err) {
      return initialResponse
    }

    // The stream was already consumed. We cannot retry the request. A solution
    // would be to tee() the input stream but that would bufferize the entire
    // stream in memory which can lead to memory starvation. Instead, we will
    // return the original response and let the calling code handle retries.
    if (ReadableStream && init?.body instanceof ReadableStream) {
      return initialResponse
    }

    const finalAuth = `${tokenSetFresh.token_type} ${tokenSetFresh.access_token}`
    const finalUrl = new URL(pathname, tokenSetFresh.aud)

    headers.set('Authorization', finalAuth)

    const finalResponse = await this.dpopFetch(finalUrl, { ...init, headers })

    // The token was successfully refreshed, but is still not accepted by the
    // resource server. This might be due to the resource server not accepting
    // credentials from the authorization server (e.g. because some migration
    // occurred). Any ways, there is no point in keeping the session.
    if (isInvalidTokenResponse(finalResponse)) {
      // TODO: Is there a "softer" way to handle this, e.g. by marking the
      // session as "expired" in the session store, allowing the user to trigger
      // a new login (using login_hint)?
      await this.sessionGetter.delStored(
        this.sub,
        new TokenInvalidError(this.sub),
      )
    }

    return finalResponse
  }
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6750#section-3}
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#name-resource-server-provided-no}
 */
function isInvalidTokenResponse(response: Response) {
  if (response.status !== 401) return false
  const wwwAuth = response.headers.get('WWW-Authenticate')
  return (
    wwwAuth != null &&
    (wwwAuth.startsWith('Bearer ') || wwwAuth.startsWith('DPoP ')) &&
    wwwAuth.includes('error="invalid_token"')
  )
}
