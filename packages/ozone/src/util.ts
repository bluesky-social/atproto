import { createRetryable } from '@atproto/common'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { parseList } from 'structured-headers'
import Database from './db'

export const getSigningKeyId = async (
  db: Database,
  signingKey: string,
): Promise<number> => {
  const selectRes = await db.db
    .selectFrom('signing_key')
    .selectAll()
    .where('key', '=', signingKey)
    .executeTakeFirst()
  if (selectRes) {
    return selectRes.id
  }
  const insertRes = await db.db
    .insertInto('signing_key')
    .values({ key: signingKey })
    .returningAll()
    .executeTakeFirstOrThrow()
  return insertRes.id
}

export const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export const retryHttp = createRetryable((err: unknown) => {
  if (err instanceof XRPCError) {
    if (err.status === ResponseType.Unknown) return true
    return RETRYABLE_HTTP_STATUS_CODES.has(err.status)
  }
  return false
})

export type ParsedLabelers = {
  dids: string[]
  redact: Set<string>
}

export const LABELER_HEADER_NAME = 'atproto-accept-labelers'

export const parseLabelerHeader = (
  header: string | undefined,
  ignoreDid?: string,
): ParsedLabelers | null => {
  if (!header) return null
  const labelerDids = new Set<string>()
  const redactDids = new Set<string>()
  const parsed = parseList(header)
  for (const item of parsed) {
    const did = item[0].toString()
    if (!did) {
      return null
    }
    if (did === ignoreDid) {
      continue
    }
    labelerDids.add(did)
    const redact = item[1].get('redact')?.valueOf()
    if (redact === true) {
      redactDids.add(did)
    }
  }
  return {
    dids: [...labelerDids],
    redact: redactDids,
  }
}

export const defaultLabelerHeader = (dids: string[]): ParsedLabelers => {
  return {
    dids,
    redact: new Set(dids),
  }
}

export const formatLabelerHeader = (parsed: ParsedLabelers): string => {
  const parts = parsed.dids.map((did) =>
    parsed.redact.has(did) ? `${did};redact` : did,
  )
  return parts.join(',')
}
