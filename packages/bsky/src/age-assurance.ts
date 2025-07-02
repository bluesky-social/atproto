import * as jose from 'jose'
import { z } from 'zod'
import { SECOND } from '@atproto/common'
import { AgeAssuranceExternalPayload } from './api/kws/types'
import { serializeExternalPayload } from './api/kws/util'
import { KwsConfig } from './config'
import { httpLogger as log } from './logger'

export const createAgeAssuranceClient = (
  cfg: KwsConfig,
): AgeAssuranceClient => {
  return new AgeAssuranceClient(cfg)
}

type Auth = {
  accessToken: string
  expMs: number
}

// Not `.strict()` to avoid breaking if KWS adds fields.
const authResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
})

export class AgeAssuranceClient {
  private authCache: Auth | undefined

  constructor(public cfg: KwsConfig) {}

  private async auth() {
    try {
      const auth = await fetch(
        `${this.cfg.authUrl}/auth/realms/kws/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.apiKey}`).toString('base64')}`,
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
      const decoded = jose.decodeJwt(authResponse.access_token)
      const iatMs = decoded.iat ? decoded.iat * SECOND : Date.now()
      this.authCache = {
        accessToken: authResponse.access_token,
        expMs: iatMs * authResponse.expires_in * SECOND,
      }
    } catch (err) {
      log.error({ err }, 'Failed to authenticate with KWS')
      throw err
    }
  }

  private async fetchWithAuth(
    url: string,
    init: RequestInit,
    retry = true,
  ): Promise<Response> {
    if (!this.authCache || Date.now() >= this.authCache.expMs) {
      if (retry) {
        await this.auth()
        return this.fetchWithAuth(url, init, false)
      }
      log.error('KWS authentication failed: no valid access token available')
      throw new Error(
        'KWS authentication failed: no valid access token available',
      )
    }

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${this.authCache.accessToken}`,
      },
    })

    if (res.status === 401 && retry) {
      log.warn('KWS auth was retried due to 401 Unauthorized response')
      // If the token is expired, try to re-authenticate and retry the request.
      this.authCache = undefined
      return this.fetchWithAuth(url, init, false)
    }

    return res
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
      `${this.cfg.apiUrl}/v1/verifications/send-email`,
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
      log.error(
        { status: res.status, statusText: res.statusText },
        'Failed to send age assurance email',
      )
      throw new Error('Failed to send KWS age assurance email')
    }
  }
}
