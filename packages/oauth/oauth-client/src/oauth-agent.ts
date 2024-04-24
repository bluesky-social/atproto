import { GlobalFetch, fetchFailureHandler } from '@atproto-labs/fetch'
import { JwtPayload, unsafeDecodeJwt } from '@atproto/jwk'
import { OAuthServerMetadata } from '@atproto/oauth-types'

import { dpopFetchWrapper } from './fetch-dpop.js'
import { OAuthServerAgent, TokenSet } from './oauth-server-agent.js'
import { SessionGetter } from './session-getter.js'

const ReadableStream = globalThis.ReadableStream as
  | typeof globalThis.ReadableStream
  | undefined

export class OAuthAgent {
  protected dpopFetch: (
    input: string | Request | URL,
    init?: RequestInit | undefined,
  ) => Promise<Response>

  constructor(
    private readonly server: OAuthServerAgent,
    public readonly sessionId: string,
    private readonly sessionGetter: SessionGetter,
    fetch: GlobalFetch = globalThis.fetch,
  ) {
    const dpopFetch = dpopFetchWrapper({
      fetch,
      iss: server.clientMetadata.client_id,
      key: server.dpopKey,
      supportedAlgs: server.serverMetadata.dpop_signing_alg_values_supported,
      sha256: async (v) => server.crypto.sha256(v),
      nonces: server.dpopNonces,
      isAuthServer: false,
    })

    this.dpopFetch = (...args) => dpopFetch(...args).catch(fetchFailureHandler)
  }

  get serverMetadata(): Readonly<OAuthServerMetadata> {
    return this.server.serverMetadata
  }

  /**
   * @param refresh See {@link SessionGetter.getSession}
   */
  async getTokenSet(refresh?: boolean): Promise<TokenSet> {
    const { tokenSet } = await this.sessionGetter.getSession(
      this.sessionId,
      refresh,
    )
    return tokenSet
  }

  async getUserinfo(): Promise<{
    userinfo?: JwtPayload
    expired?: boolean
    scope?: string
    iss: string
    aud: string
    sub: string
  }> {
    const tokenSet = await this.getTokenSet()

    return {
      userinfo: tokenSet.id_token
        ? unsafeDecodeJwt(tokenSet.id_token).payload
        : undefined,
      expired:
        tokenSet.expires_at == null
          ? undefined
          : new Date(tokenSet.expires_at).getTime() < Date.now() - 5e3,
      scope: tokenSet.scope,
      iss: tokenSet.iss,
      aud: tokenSet.aud,
      sub: tokenSet.sub,
    }
  }

  async signOut(): Promise<void> {
    try {
      const { tokenSet } = await this.sessionGetter.getSession(
        this.sessionId,
        false,
      )
      await this.server.revoke(tokenSet.access_token)
    } finally {
      await this.sessionGetter.delStored(this.sessionId)
    }
  }

  async request(pathname: string, init?: RequestInit): Promise<Response> {
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
    if (!isTokenExpiredResponse(initialResponse)) return initialResponse

    // If there is no refresh token, no need to try to refresh the token
    if (!tokenSet.refresh_token) return initialResponse

    let tokenSetFresh: TokenSet
    try {
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

    const updatedAuth = `${tokenSetFresh.token_type} ${tokenSetFresh.access_token}`

    // No point in retrying the request if the token is still the same
    if (updatedAuth === initialAuth) {
      return initialResponse
    }

    const updatedUrl = new URL(pathname, tokenSetFresh.aud)

    headers.set('Authorization', updatedAuth)

    return this.dpopFetch(updatedUrl, { ...init, headers })
  }
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6750#section-3}
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#name-resource-server-provided-no}
 */
function isTokenExpiredResponse(response: Response) {
  if (response.status !== 401) return false
  const wwwAuth = response.headers.get('WWW-Authenticate')
  return (
    wwwAuth != null &&
    wwwAuth.startsWith('Bearer ') &&
    wwwAuth.includes('error="invalid_token"')
  )
}
