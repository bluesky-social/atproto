import { NoHandleRecordError, resolveDns } from '@atproto/identifier'
import { httpLogger } from '../logger'
import { AtpAgent } from '@atproto/api'
import { retryHttp } from './retry'

export const resolveExternalHandle = async (
  handle: string,
): Promise<string | undefined> => {
  try {
    const did = await resolveDns(handle)
    return did
  } catch (err) {
    if (err instanceof NoHandleRecordError) {
      // no worries it's just not found
    } else {
      httpLogger.error({ err, handle }, 'could not resolve dns handle')
    }
  }
  try {
    // @TODO we don't need non-tls for our tests, but it might be useful to support
    const { api } = new AtpAgent({ service: `https://${handle}` })
    const res = await retryHttp(() =>
      api.com.atproto.identity.resolveHandle({ handle }),
    )
    return res.data.did
  } catch (err) {
    return undefined
  }
}
