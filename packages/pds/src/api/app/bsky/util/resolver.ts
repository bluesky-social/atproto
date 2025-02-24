import { DidDocument, PoorlyFormattedDidDocumentError } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'

// provides http-friendly errors during did resolution
export const getDidDoc = async (ctx: AppContext, did: string) => {
  let resolved: DidDocument | null
  try {
    resolved = await ctx.idResolver.did.resolve(did)
  } catch (err) {
    if (err instanceof PoorlyFormattedDidDocumentError) {
      throw new InvalidRequestError(`invalid did document: ${did}`)
    }
    throw err
  }
  if (!resolved) {
    throw new InvalidRequestError(`could not resolve did document: ${did}`)
  }
  return resolved
}
