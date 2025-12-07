import { z } from 'zod'

export const KWS_EXTERNAL_PAYLOAD_CHAR_LIMIT = 250

/**
 * Thrown when the provided external payload exceeds KWS's character limit.
 *
 * This is most commonly caused by DIDs that are too long, such as for
 * `did:web` DIDs. But it's very rare, and the client has special handling for
 * this case.
 */
export class KWSExternalPayloadTooLargeError extends Error {}

export enum KWSExternalPayloadVersion {
  V1 = '1',
  V2 = '2',
}

export function parseKWSExternalPayloadVersion(raw: string) {
  switch (raw) {
    case KWSExternalPayloadVersion.V2:
      return KWSExternalPayloadVersion.V2
    default:
      return KWSExternalPayloadVersion.V1
  }
}

export type KWSExternalPayloadV1 = {
  actorDid: string
  attemptId: string
}

export const KWSExternalPayloadV1Schema = z.object({
  actorDid: z.string(),
  attemptId: z.string(),
})

export function parseKWSExternalPayloadV1(raw: string): KWSExternalPayloadV1 {
  try {
    const value: unknown = JSON.parse(raw)
    return KWSExternalPayloadV1Schema.parse(value)
  } catch (err) {
    throw new Error(`Failed to parse KWSExternalPayloadV1`, {
      cause: err,
    })
  }
}

export function serializeKWSExternalPayloadV1(
  payload: KWSExternalPayloadV1,
): string {
  try {
    return JSON.stringify(KWSExternalPayloadV1Schema.parse(payload))
  } catch (err) {
    throw new Error('Failed to serialize KWSExternalPayloadV1', { cause: err })
  }
}

/**
 * During our migration from v1 to v2 of the KWS external payload, we'll be
 * sending v2 payloads on the v1 flow (the `adult-verified` email flow). We use
 * this utility to parse either v1 or v2 payloads in that flow.
 *
 * Check for the `version` field on the output of this method to discriminate
 * between the two types and handle them differently.
 */
export function parseKWSExternalPayloadV1WithV2Compat(
  raw: string,
):
  | (KWSExternalPayloadV1 & { version: KWSExternalPayloadVersion.V1 })
  | KWSExternalPayloadV2 {
  const deserialized = JSON.parse(raw)
  const v2 = deserialized.v === KWSExternalPayloadVersion.V2

  if (v2) {
    return parseKWSExternalPayloadV2(raw)
  } else {
    return {
      ...parseKWSExternalPayloadV1(raw),
      version: KWSExternalPayloadVersion.V1,
    }
  }
}

/***************************
 * KWS External Payload V2 *
 ***************************/

export type KWSExternalPayloadV2 = {
  version: KWSExternalPayloadVersion.V2
  attemptId: string
  actorDid: string
  countryCode: string
  regionCode?: string
}

export const KWSExternalPayloadV2Schema = z.object({
  v: z.string(),
  id: z.string(),
  did: z.string(),
  gc: z.string().length(2),
  gr: z.string().optional(),
})

export function serializeKWSExternalPayloadV2(
  payload: KWSExternalPayloadV2,
): string {
  let compressed: z.infer<typeof KWSExternalPayloadV2Schema>
  try {
    compressed = KWSExternalPayloadV2Schema.parse({
      v: KWSExternalPayloadVersion.V2, // version
      id: payload.attemptId,
      did: payload.actorDid,
      gc: payload.countryCode, // geolocation country
      gr: payload.regionCode, // geolocation region
    })
  } catch (err) {
    throw new Error('Failed to serialize KWSExternalPayloadV2', { cause: err })
  }

  const serialized = JSON.stringify(compressed)

  if (serialized.length > KWS_EXTERNAL_PAYLOAD_CHAR_LIMIT) {
    throw new KWSExternalPayloadTooLargeError(
      `Serialized external payload size ${serialized.length} exceeds limit of ${KWS_EXTERNAL_PAYLOAD_CHAR_LIMIT}`,
    )
  }

  return serialized
}

export function parseKWSExternalPayloadV2(raw: string): KWSExternalPayloadV2 {
  try {
    const deserialized = JSON.parse(raw)
    const parsed = KWSExternalPayloadV2Schema.parse(deserialized)

    return {
      version: KWSExternalPayloadVersion.V2,
      attemptId: parsed.id,
      actorDid: parsed.did,
      countryCode: parsed.gc,
      regionCode: parsed.gr,
    }
  } catch (err) {
    throw new Error(`Failed to parse KWSExternalPayloadV2`, {
      cause: err,
    })
  }
}
