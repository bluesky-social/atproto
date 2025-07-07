import { z } from 'zod'
import { AgeAssuranceExternalPayload } from './api/kws/types'
import { serializeExternalPayload } from './api/kws/util'
import { buildBasicAuth } from './auth-verifier'
import { KwsConfig } from './config'
import { httpLogger as log } from './logger'

export const createAgeAssuranceClient = (
  cfg: KwsConfig,
): AgeAssuranceClient => {
  return new AgeAssuranceClient(cfg)
}

// Not `.strict()` to avoid breaking if KWS adds fields.
const authResponseSchema = z.object({
  access_token: z.string(),
})

export class AgeAssuranceClient {
  constructor(public cfg: KwsConfig) {}

  private async auth() {
    try {
      const auth = await fetch(
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
      if (!auth.ok) {
        throw new Error(
          `Failed to fetch access token: ${auth.status} ${auth.statusText}`,
        )
      }

      const res = await auth.json()
      const authResponse = authResponseSchema.parse(res)
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

  async sendEmail({
    email,
    language,
    externalPayload,
  }: {
    email: string
    language: string
    externalPayload: AgeAssuranceExternalPayload
  }) {
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
          externalPayload: serializeExternalPayload(externalPayload),
          language,
          location: 'US',
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
      throw new Error('Failed to send KWS age assurance email')
    }

    return res.json()
  }
}
