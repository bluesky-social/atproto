import { z } from 'zod'
import { KwsConfig, ServerConfig } from '../../config'
import { AppContext } from '../../context'
import { KwsClient } from '../../kws'

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
})

// Not `.strict()` to avoid breaking if KWS adds fields.
export const webhookBodyIntermediateSchema = z.object({
  payload: z.object({
    externalPayload: z.string(),
    status: statusSchema,
  }),
})
