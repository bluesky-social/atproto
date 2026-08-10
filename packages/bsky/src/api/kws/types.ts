import { z } from 'zod'
import type { KwsConfig, ServerConfig } from '../../config.js'
import type { AppContext } from '../../context.js'
import type { KwsClient } from '../../kws.js'

export type AppContextWithKwsClient = AppContext & {
  kwsClient: KwsClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

export type KwsExternalPayload = {
  actorDid: string
  attemptId: string
}

// `.strict()` because we control the payload structure.
export const externalPayloadSchema = z
  .object({
    actorDid: z.string(),
    attemptId: z.string(),
  })
  .strict()

export type KwsStatus = {
  verified: boolean
  // A unique reference ID for the verification transaction.
  transactionId?: string
  // A code indicating the reason for failure, or null when verification
  // succeeded.
  errorCode?: string | null
  // Epoch seconds indicating when KWS generated the payload. Optional so we
  // remain compatible with payloads sent before this field was introduced.
  timestamp?: number
}

export type KwsVerificationIntermediateQuery = {
  externalPayload: string
  status: string
  signature: string
}

// Not `.strict()` to avoid breaking if KWS adds fields.
export const verificationIntermediateQuerySchema = z.object({
  externalPayload: z.string(),
  signature: z.string(),
  status: z.string(),
})

export type KwsVerificationQuery = {
  externalPayload: KwsExternalPayload
  signature: string
  status: KwsStatus
}

export type KwsWebhookBody = {
  payload: {
    externalPayload: KwsExternalPayload
    status: KwsStatus
  }
}

// Not `.strict()` to avoid breaking if KWS adds fields.
export const statusSchema = z.object({
  verified: z.boolean(),
  transactionId: z.string().optional(),
  errorCode: z.string().nullable().optional(),
  timestamp: z.number().optional(),
})

// Not `.strict()` to avoid breaking if KWS adds fields.
export const webhookBodyIntermediateSchema = z.object({
  payload: z.object({
    externalPayload: z.string(),
    status: statusSchema,
  }),
})
