import { AxiosError } from 'axios'
import { XRPCError, ResponseType } from '@atproto/xrpc'
import { RetryOptions, retry } from '@atproto/common'
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

export async function retryHttp<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  return retry(fn, { retryable: retryableHttp, ...opts })
}

export function retryableHttp(err: unknown) {
  if (err instanceof XRPCError) {
    if (err.status === ResponseType.Unknown) return true
    return retryableHttpStatusCodes.has(err.status)
  }
  if (err instanceof AxiosError) {
    if (!err.response) return true
    return retryableHttpStatusCodes.has(err.response.status)
  }
  return false
}

const retryableHttpStatusCodes = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])
