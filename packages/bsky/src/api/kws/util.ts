import crypto from 'node:crypto'
import type express from 'express'
import { TID } from '@atproto/common'
import type { DatetimeString } from '@atproto/syntax'
import type { AppContext } from '../../context.js'
import type { app } from '../../lexicons/index.js'
import { Namespaces } from '../../stash.js'
import {
  type KwsExternalPayload,
  type KwsStatus,
  externalPayloadSchema,
  statusSchema,
} from './types.js'

export const createStashEvent = async (
  ctx: AppContext,
  {
    actorDid,
    attemptId,
    email,
    initIp,
    initUa,
    completeIp,
    completeUa,
    status,
  }: {
    actorDid: string
    attemptId: string
    email?: string
    initIp?: string
    initUa?: string
    completeIp?: string
    completeUa?: string
    status: app.bsky.unspecced.defs.AgeAssuranceState['status']
  },
) => {
  const stashPayload: app.bsky.unspecced.defs.AgeAssuranceEvent = {
    createdAt: new Date().toISOString() as DatetimeString,
    email,
    status,
    attemptId,
    initIp,
    initUa,
    completeIp,
    completeUa,
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

export const serializeExternalPayload = (value: KwsExternalPayload): string => {
  return JSON.stringify(value)
}

export const parseExternalPayload = (
  serialized: string,
): KwsExternalPayload => {
  try {
    const value: unknown = JSON.parse(serialized)
    return externalPayloadSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid external payload: ${serialized}`, { cause: err })
  }
}

export const parseStatus = (serialized: string): KwsStatus => {
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

export const getClientUa = (req: express.Request): string | undefined => {
  return req.headers['user-agent']
}
