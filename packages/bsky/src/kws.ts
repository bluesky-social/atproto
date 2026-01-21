import { z } from 'zod'
import { KwsExternalPayload } from './api/kws/types'
import { serializeExternalPayload } from './api/kws/util'
import { buildBasicAuth } from './auth-verifier'
import { KwsConfig } from './config'
import { httpLogger as log } from './logger'

export const createKwsClient = (cfg: KwsConfig): KwsClient => {
  return new KwsClient(cfg)
}

// Not `.strict()` to avoid breaking if KWS adds fields.
const authResponseSchema = z.object({
  access_token: z.string(),
})

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
  constructor(public cfg: KwsConfig) {}

  private async auth() {
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
      return authResponse.access_token
    } catch (err) {
      log.error({ err }, 'Failed to authenticate with KWS')
      throw err
    }
  }

  private async fetchWithAuth(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const accessToken = await this.auth()

    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    })
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
