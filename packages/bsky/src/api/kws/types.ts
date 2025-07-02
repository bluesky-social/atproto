import { z } from 'zod'
import { AgeAssuranceClient } from '../../age-assurance'
import { KwsConfig, ServerConfig } from '../../config'
import { AppContext } from '../../context'

export type AppContextWithAgeAssuranceClient = AppContext & {
  ageAssuranceClient: AgeAssuranceClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

export type AgeAssuranceApiQuery = {
  externalPayload: AgeAssuranceExternalPayload
  signature: string
  status: AgeAssuranceStatus
}

// Not `.strict()` to avoid breaking if KWS adds fields.
export const apiQueryIntermediateSchema = z.object({
  externalPayload: z.string(),
  signature: z.string(),
  status: z.string(),
})

export type AgeAssuranceWebhookBody = {
  payload: {
    externalPayload: AgeAssuranceExternalPayload
    status: AgeAssuranceStatus
  }
}

// Not `.strict()` to avoid breaking if KWS adds fields.
export const webhookBodyIntermediateSchema = z.object({
  payload: z.object({
    externalPayload: z.string(),
    status: z.object({
      verified: z.boolean(),
    }),
  }),
})

export type AgeAssuranceExternalPayload = {
  actorDid: string
  attemptId: string
  attemptIp?: string
}

// `.strict()` because we control the payload structure.
export const externalPayloadSchema = z
  .object({
    actorDid: z.string(),
    attemptId: z.string(),
    attemptIp: z.string().optional(),
  })
  .strict()

export type AgeAssuranceStatus = {
  verified: boolean
}

// Not `.strict()` to avoid breaking if KWS adds fields.
export const statusSchema = z.object({
  verified: z.boolean(),
})
