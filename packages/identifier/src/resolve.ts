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
      throw new NoHandleRecordError()
    }
    throw err
  }
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.find((i) => i.startsWith(PREFIX))
  if (!found) throw new NoHandleRecordError()
  return found.slice(PREFIX.length)
}

export class NoHandleRecordError extends Error {}
