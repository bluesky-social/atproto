import crypto from 'node:crypto'
import { TID } from '@atproto/common'
import { AppContext } from '../../context'
import {
  AgeAssuranceEvent,
  AgeAssuranceState,
} from '../../lexicon/types/app/bsky/unspecced/defs'
import { Namespaces } from '../../stash'
import {
  AgeAssuranceExternalPayload,
  AgeAssuranceStatus,
  externalPayloadSchema,
  statusSchema,
} from './types'

export const createStashEvent = async (
  ctx: AppContext,
  {
    actorDid,
    attemptId,
    attemptIp,
    status,
  }: {
    actorDid: string
    attemptId: string
    attemptIp?: string
    status: AgeAssuranceState['status']
  },
) => {
  const stashPayload: AgeAssuranceEvent = {
    createdAt: new Date().toISOString(),
    status,
    attemptId,
    attemptIp,
  }
  await ctx.stashClient.create({
    actorDid,
    namespace: Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent,
    key: TID.nextStr(),
    payload: stashPayload,
  })
  return stashPayload
}

export const validateSignature = (
  key: string,
  data: string,
  signature: string,
) => {
  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(data)
    .digest('hex')

  const expectedSignatureBuf = Buffer.from(expectedSignature, 'hex')
  const actualSignatureBuf = Buffer.from(signature, 'hex')

  if (expectedSignatureBuf.length !== actualSignatureBuf.length) {
    throw new Error(`Signature mismatch`)
  }

  if (!crypto.timingSafeEqual(expectedSignatureBuf, actualSignatureBuf)) {
    throw new Error(`Signature mismatch`)
  }
}

export const serializeExternalPayload = (
  value: AgeAssuranceExternalPayload,
): string => {
  return JSON.stringify(value)
}

export const parseExternalPayload = (
  serialized: string,
): AgeAssuranceExternalPayload => {
  try {
    const value: unknown = JSON.parse(serialized)
    return externalPayloadSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid external payload: ${serialized}`, { cause: err })
  }
}

export const parseStatus = (serialized: string): AgeAssuranceStatus => {
  try {
    const value: unknown = JSON.parse(serialized)
    return statusSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid status: ${serialized}`, { cause: err })
  }
}

export const kwsWwwAuthenticate = (): Record<string, string> => ({
  'www-authenticate': `Signature realm="kws"`,
})
