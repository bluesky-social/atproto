import ApiAgent from '@atproto/api'
import * as handleLib from '@atproto/handle'
import { httpLogger as log } from '../../../../logger'

export const resolveExternalHandle = async (
  scheme: string,
  handle: string,
): Promise<string | undefined> => {
  try {
    const did = await handleLib.resolveDns(handle)
    return did
  } catch (err) {
    if (err instanceof handleLib.NoHandleRecordError) {
      // no worries it's just not found
    } else {
      log.error({ err, handle }, 'could not resolve dns handle')
    }
  }
  try {
    const agent = new ApiAgent({ service: `${scheme}://${handle}` })
    const res = await agent.api.com.atproto.identity.resolveHandle({ handle })
    return res.data.did
  } catch (err) {
    return undefined
  }
}
