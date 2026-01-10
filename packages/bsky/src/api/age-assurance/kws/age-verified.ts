import { z } from 'zod'

/**
 * Schema for KWS the `status` object on `age-verified` payloads.
 */
export const KWSAgeVerifiedStatusSchema = z.object({
  verified: z.boolean(),
  verifiedMinimumAge: z.number(),
  transactionId: z.string().optional(),
})

/**
 * The KWS `status` object on `age-verified` payloads.
 */
export type KWSAgeVerifiedStatus = z.infer<typeof KWSAgeVerifiedStatusSchema>

export function serializeKWSAgeVerifiedStatus(
  status: KWSAgeVerifiedStatus,
): string {
  return JSON.stringify(KWSAgeVerifiedStatusSchema.parse(status))
}

/**
 * Parse KWS `age-verified` status object.
 */
export const parseKWSAgeVerifiedStatus = (
  raw: string,
): KWSAgeVerifiedStatus => {
  try {
    const value = JSON.parse(raw)
    return KWSAgeVerifiedStatusSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid KWS age-verified status: ${raw}`, {
      cause: err,
    })
  }
}

/**
 * Schema for KWS `age-verified` webhooks.
 *
 * Note: we don't use `.strict()` here so that we avoid breaking if KWS adds
 * fields, and some fields below are not strictly typed since we're not using
 * them.
 */
export const KWSAgeVerifiedWebhookSchema = z.object({
  name: z.string(),
  time: z.string(), // ISO8601 timestamp, but don't validate here
  orgId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  payload: z.object({
    email: z.string(), // no need to validate here
    externalPayload: z.string(),
    status: KWSAgeVerifiedStatusSchema,
  }),
})

/**
 * The raw KWS `age-verified` webhook body
 */
export type KWSWebhookAgeVerified = z.infer<typeof KWSAgeVerifiedWebhookSchema>

/**
 * Parse KWS `age-verified` webhook body and its external payload.
 */
export const parseKWSAgeVerifiedWebhook = (
  raw: string,
): KWSWebhookAgeVerified => {
  try {
    const value: unknown = JSON.parse(raw)
    return KWSAgeVerifiedWebhookSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid webhook body: ${raw}`, { cause: err })
  }
}
