import ApiAgent from '@atproto/api'
import * as ident from '@atproto/identifier'
import { httpLogger as log } from '../../../../logger'

export const resolveExternalHandle = async (
  scheme: string,
  handle: string,
): Promise<string | undefined> => {
  try {
    const did = await ident.resolveDns(handle)
    return did
  } catch (err) {
    if (err instanceof ident.NoHandleRecordError) {
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
