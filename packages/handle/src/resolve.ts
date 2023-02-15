import { isErrnoException } from '@atproto/common'
import dns from 'dns/promises'

const SUBDOMAIN = '_atproto'

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
  const found = results.find((i) => i.startsWith('did:'))
  if (!found) throw new NoHandleRecordError()
  return found
}

export class NoHandleRecordError extends Error {}
