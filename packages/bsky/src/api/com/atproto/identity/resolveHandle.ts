import * as ident from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
    const handle = ident.normalizeHandle(params.handle || req.hostname)

    const cacheControl = req.headers['cache-control']
    const forceResolve =
      cacheControl?.includes('no-cache') || cacheControl?.includes('max-age=0')

    const did = await resolveHandle(handle, forceResolve)
    if (!did) {
      throw new InvalidRequestError('Unable to resolve handle')
    }

    return {
      encoding: 'application/json',
      body: { did },
      headers: {
        'cache-control': 'max-age=60',
      },
    }
  })

  async function resolveHandle(
    handle: string,
    forceResolve = false,
  ): Promise<string | undefined> {
    const [dataplaneDid] = await ctx.hydrator.actor.getDids([handle])

    // @TODO: We should ideally *not* resolve again if the dataplane data was
    // refreshed recently. In order to do this, we need the dataplane to return
    // a timestamp of when the data was last updated. This is not implemented
    // yet, so we always resolve for now.
    if (forceResolve || !dataplaneDid) {
      const resolvedDid = await ctx.idResolver.handle.resolve(handle)

      if (resolvedDid !== dataplaneDid) {
        // @TODO: Update dataplane with did
      }

      return resolvedDid
    }

    return dataplaneDid
  }
}
