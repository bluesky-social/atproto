import { KwsConfig } from './config'

export const createAgeAssuranceClient = (
  cfg: KwsConfig,
): AgeAssuranceClient => {
  return new AgeAssuranceClient(cfg)
}

export type AgeAssuranceExternalPayload = {
  actorDid: string
  attemptId: string
}

export class AgeAssuranceClient {
  constructor(public cfg: KwsConfig) {}

  private async accessToken() {
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

    // @TODO: Try oauth lib to handle this.
    const { access_token } = (await auth.json()) as {
      access_token: string
      expires_in: number
    }

    return access_token
  }

  serializeExternalPayload(value: AgeAssuranceExternalPayload): string {
    return JSON.stringify(value)
  }

  parseExternalPayload(serialized: string): AgeAssuranceExternalPayload {
    const isAgeAssuranceExternalPayload = (
      v: unknown,
    ): v is AgeAssuranceExternalPayload => {
      return (
        !!v &&
        typeof v === 'object' &&
        'actorDid' in v &&
        typeof v.actorDid === 'string' &&
        'attemptId' in v &&
        typeof v.attemptId === 'string' &&
        Object.keys(v).length === 2
      )
    }

    const value: unknown = JSON.parse(serialized)
    if (isAgeAssuranceExternalPayload(value)) {
      return value
    }

    throw new Error(`Invalid external payload: ${serialized}`)
  }

  async sendEmail({
    actorDid,
    attemptId,
    email,
    language,
  }: {
    actorDid: string
    attemptId: string
    email: string
    language: string
  }) {
    const accessToken = await this.accessToken()

    await fetch(`${this.cfg.apiUrl}/v1/verifications/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': this.cfg.userAgent,
      },
      body: JSON.stringify({
        email,
        externalPayload: this.serializeExternalPayload({ actorDid, attemptId }),
        language,
        location: 'US',
        userContext: 'adult',
      }),
    })
  }
}
