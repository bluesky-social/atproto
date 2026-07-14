import { z } from 'zod'
import type { KwsExternalPayload } from './api/kws/types.js'
import { serializeExternalPayload } from './api/kws/util.js'
import { buildBasicAuth } from './auth-verifier.js'
import type { KwsConfig } from './config.js'
import { httpLogger as log } from './logger.js'

export const createKwsClient = (cfg: KwsConfig): KwsClient => {
  return new KwsClient(cfg)
}

// Not `.strict()` to avoid breaking if KWS adds fields.
const authResponseSchema = z.object({
  access_token: z.string(),
  // Seconds the token remains valid. KWS notes this varies with usage, and
  // it's optional here: if absent we can't anticipate expiry, so we skip
  // caching and lean on the reactive re-auth-on-401 path instead.
  expires_in: z.number().optional(),
})

// Re-authenticate once the token has burned through this fraction of its
// advertised lifetime, so we never send a token that's on the edge of expiry.
const TOKEN_LIFETIME_REFRESH_RATIO = 0.9

type CachedToken = { accessToken: string; expiresAt: number }

const EXTERNAL_PAYLOAD_CHAR_LIMIT = 200
/**
 * Thrown when the provided external payload exceeds KWS's character limit.
 * This is most commonly caused by DIDs that are too long, such as for
 * `did:web` DIDs. But it's very rare, and the client has special handling for
 * this case.
 */
export class KwsExternalPayloadError extends Error {}

export type KWSSendEmailRequestCommon = {
  email: string
  location: string
  language: string
  externalPayload: string
}

export type KWSSendEmailRequest =
  | (KWSSendEmailRequestCommon & {
      userContext: 'adult'
    })
  | (KWSSendEmailRequestCommon & {
      userContext: 'age'
      minimumAge: number
    })

export class KwsClient {
  private cachedToken?: CachedToken
  // In-flight auth request, so concurrent callers share a single token fetch
  // rather than each hitting the token endpoint (which the WAF rate-limits).
  private pendingAuth?: Promise<string>

  constructor(public cfg: KwsConfig) {}

  /**
   * Returns a valid access token, reusing the cached one until it nears
   * expiry. Pass `force` to bypass the cache and mint a fresh token, e.g.
   * after a 401 from the API indicates the current token was rejected.
   */
  private async auth(force = false): Promise<string> {
    if (!force && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.accessToken
    }
    // Coalesce concurrent (re-)auth attempts onto one request.
    if (!this.pendingAuth) {
      this.pendingAuth = this.fetchToken().finally(() => {
        this.pendingAuth = undefined
      })
    }
    return this.pendingAuth
  }

  private async fetchToken(): Promise<string> {
    try {
      const res = await fetch(
        `${this.cfg.authOrigin}/auth/realms/kws/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: buildBasicAuth(this.cfg.clientId, this.cfg.apiKey),
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'verification',
          }),
        },
      )
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(
          `Failed to fetch age assurance access token: status: ${res.status}, statusText: ${res.statusText}, errorText: ${errorText}`,
        )
      }

      const auth = await res.json()
      const authResponse = authResponseSchema.parse(auth)
      if (authResponse.expires_in == null) {
        // Without a lifetime we can't proactively refresh, but we still cache
        // the token and reuse it until a 401 triggers the re-auth-on-401 path.
        log.error('KWS auth response missing expires_in; caching without a TTL')
      }
      this.cachedToken = {
        accessToken: authResponse.access_token,
        expiresAt:
          authResponse.expires_in == null
            ? Infinity
            : Date.now() +
              authResponse.expires_in * 1000 * TOKEN_LIFETIME_REFRESH_RATIO,
      }
      return authResponse.access_token
    } catch (err) {
      // Drop any stale cache so the next call retries the token fetch.
      this.cachedToken = undefined
      log.error({ err }, 'Failed to authenticate with KWS')
      throw err
    }
  }

  private async fetchWithAuth(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${await this.auth()}`,
      },
    })

    // A 401 means the token expired (KWS token TTL is variable). Re-auth once
    // with a fresh token and retry, per the KWS integration docs.
    if (res.status === 401) {
      return fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${await this.auth(true)}`,
        },
      })
    }

    return res
  }

  /**
   * @deprecated Use `sendAdultVerifiedFlowEmail` or `sendAgeVerifiedFlowEmail` instead.
   */
  async sendEmail({
    countryCode,
    email,
    externalPayload,
    language,
  }: {
    countryCode: string
    email: string
    externalPayload: KwsExternalPayload
    language: string
  }) {
    const serializedExternalPayload = serializeExternalPayload(externalPayload)
    if (serializedExternalPayload.length > EXTERNAL_PAYLOAD_CHAR_LIMIT) {
      throw new KwsExternalPayloadError()
    }

    const res = await this.fetchWithAuth(
      `${this.cfg.apiOrigin}/v1/verifications/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.cfg.userAgent,
        },
        body: JSON.stringify({
          email,
          externalPayload: serializedExternalPayload,
          language,
          location: countryCode,
          userContext: 'adult',
        }),
      },
    )

    if (!res.ok) {
      const errorText = await res.text()
      log.error(
        { status: res.status, statusText: res.statusText, errorText },
        'Failed to send age assurance email',
      )
      throw new Error('Failed to send age assurance email')
    }

    return res.json()
  }

  /**
   * Sends a KWS verification email with the given properties.
   */
  async email(props: KWSSendEmailRequest) {
    const res = await this.fetchWithAuth(
      `${this.cfg.apiOrigin}/v1/verifications/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.cfg.userAgent,
        },
        body: JSON.stringify(props),
      },
    )

    if (!res.ok) {
      const errorText = await res.text()
      log.error(
        {
          status: res.status,
          statusText: res.statusText,
          errorText,
          flow: props.userContext,
        },
        'Failed to send KWS email',
      )
      throw new Error('Failed to send KWS email')
    }

    return res.json()
  }

  /**
   * Sends an email to the user initiating an `adult` verification flow, which
   * results in `adult-verified` events/webhooks.
   */
  async sendAdultVerifiedFlowEmail(props: KWSSendEmailRequestCommon) {
    return this.email({
      ...props,
      userContext: 'adult',
    })
  }

  /**
   * Sends an email to the user initiating an `age` verification flow, which
   * results in `age-verified` events/webhooks.
   */
  async sendAgeVerifiedFlowEmail(props: KWSSendEmailRequestCommon) {
    return this.email({
      ...props,
      userContext: 'age',
      minimumAge: 16, // KWS required value
    })
  }
}
