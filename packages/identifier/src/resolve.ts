import { isErrnoException } from '@atproto/common-web'
import dns from 'dns/promises'

export const resolveHandle = async (
  handle: string,
  scheme?: string,
): Promise<string | undefined> => {
  const dnsPromise = resolveDns(handle)
  const httpAbort = new AbortController()
  const httpPromise = resolveHttp(handle, scheme, httpAbort.signal).catch(
    () => undefined,
  )
  const dnsRes = await dnsPromise
  if (dnsRes) {
    httpAbort.abort()
    return dnsRes
  }
  return httpPromise
}

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export const resolveDns = async (
  handle: string,
): Promise<string | undefined> => {
  let chunkedResults: string[][]
  try {
    chunkedResults = await dns.resolveTxt(`${SUBDOMAIN}.${handle}`)
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOTFOUND') {
      return undefined
    }
    throw err
  }
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.filter((i) => i.startsWith(PREFIX))
  if (found.length !== 1) {
    return undefined
  }
  return found[0].slice(PREFIX.length)
}

export const resolveHttp = async (
  handle: string,
  scheme = 'https',
  signal?: AbortSignal,
): Promise<string | undefined> => {
  const url = `${scheme}://${handle}/.well-known/atproto-handle/${handle}`
  let maybeDid: string
  try {
    const res = await fetch(url, { signal })
    maybeDid = await res.text()
  } catch (err) {
    return undefined
  }
  if (!maybeDid.startsWith('did:')) {
    return undefined
  }
  return maybeDid
}

export class NoHandleRecordError extends Error {
  constructor(public handle: string) {
    super(`No record found at ${handle}`)
  }
}
export class ManyHandleRecordsError extends Error {
  constructor(public handle: string, records: string[]) {
    super(`Many records found at record found at ${handle}: ${records}`)
  }
}
