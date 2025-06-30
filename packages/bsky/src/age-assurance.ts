import crypto from 'node:crypto'
import { z } from 'zod'
import { KwsConfig } from './config'

export const createAgeAssuranceClient = (
  cfg: KwsConfig,
): AgeAssuranceClient => {
  return new AgeAssuranceClient(cfg)
}

export type AgeAssuranceExternalPayload = {
  actorDid: string
  attemptId: string
  attemptIp?: string
}

const externalPayloadSchema = z
  .object({
    actorDid: z.string(),
    attemptId: z.string(),
    attemptIp: z.string().optional(),
  })
  .strict()

type AgeAssuranceWebhookIntermediateBody = {
  payload: {
    externalPayload: string
    status: {
      verified: boolean
    }
  }
}

export type AgeAssuranceWebhookPayload = {
  payload: Omit<
    AgeAssuranceWebhookIntermediateBody['payload'],
    'externalPayload'
  > & {
    externalPayload: AgeAssuranceExternalPayload
  }
}

const webhookBodyIntermediateSchema = z.object({
  payload: z.object({
    externalPayload: z.string(),
    status: z.object({
      verified: z.boolean(),
    }),
  }),
})

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
    const value: unknown = JSON.parse(serialized)

    try {
      return externalPayloadSchema.parse(value)
    } catch (err) {
      throw new Error(`Invalid external payload: ${serialized}`, { cause: err })
    }
  }

  parseWebhookBody(serialized: string): AgeAssuranceWebhookPayload {
    const value: unknown = JSON.parse(serialized)

    try {
      const intermediate: AgeAssuranceWebhookIntermediateBody =
        webhookBodyIntermediateSchema.parse(value)

      return {
        ...intermediate,
        payload: {
          ...intermediate.payload,
          externalPayload: this.parseExternalPayload(
            intermediate.payload.externalPayload,
          ),
        },
      }
    } catch (err) {
      throw new Error(`Invalid external payload: ${serialized}`, { cause: err })
    }
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
        externalPayload: this.serializeExternalPayload(externalPayload),
        language,
        location: 'US',
        userContext: 'adult',
      }),
    })
  }

  validateWebhookSignature(body: Buffer, sig: string | string[] | undefined) {
    if (!sig) {
      throw new Error('Missing webhook signature')
    }

    const signatureHeader = Array.isArray(sig) ? sig.join(',') : sig
    const [t, v1] = signatureHeader.split(',')
    const timestamp = t?.split('=')[1]
    const signature = v1?.split('=')[1]

    if (typeof timestamp !== 'string' || typeof signature !== 'string') {
      throw new Error('Invalid signature header format')
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.cfg.webhookSigningKey)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const signedBuffer = Buffer.from(signature, 'hex')

    if (expectedBuffer.length !== signedBuffer.length) {
      throw new Error(`Signature mismatch`)
    }

    if (!crypto.timingSafeEqual(expectedBuffer, signedBuffer)) {
      throw new Error(`Signature mismatch`)
    }
  }
}
