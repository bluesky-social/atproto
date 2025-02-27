import * as ident from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
    const handle = ident.normalizeHandle(params.handle || req.hostname)

    let [did] = await ctx.hydrator.actor.getDids([handle])

    if (!did) {
      const publicHostname = ctx.cfg.publicUrl
        ? new URL(ctx.cfg.publicUrl).hostname
        : null
      if (
        publicHostname &&
        (handle === publicHostname || handle.endsWith(`.${publicHostname}`))
      ) {
        // Avoid resolution loop
        throw new InvalidRequestError('Unable to resolve handle')
      }
      // this is not someone on our server, but we help with resolving anyway
      did = await ctx.idResolver.handle.resolve(handle)
    }
    if (!did) {
      throw new InvalidRequestError('Unable to resolve handle')
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })
}
