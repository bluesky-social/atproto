import { isErrnoException } from '@atproto/common-web'
import dns from 'dns/promises'

const SUBDOMAIN = '_atproto'
const PREFIX = 'did='

export const resolveDns = async (handle: string): Promise<string> => {
  let chunkedResults: string[][]
  try {
    chunkedResults = await dns.resolveTxt(`${SUBDOMAIN}.${handle}`)
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOTFOUND') {
      throw new NoHandleRecordError(handle)
    }
    throw err
  }
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.filter((i) => i.startsWith(PREFIX))
  if (found.length < 1) {
    throw new NoHandleRecordError(handle)
  } else if (found.length > 1) {
    throw new ManyHandleRecordsError(handle, found)
  }
  return found[0].slice(PREFIX.length)
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
