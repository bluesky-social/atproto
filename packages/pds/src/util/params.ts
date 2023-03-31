import { InvalidRequestError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'

export const parseCidParam = (cid: string): CID => {
  try {
    return CID.parse(cid)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new InvalidRequestError('Invalid cid')
    }
    throw err
  }
}
