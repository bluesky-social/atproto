import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
    const handle = ident.normalizeHandle(params.handle || req.hostname)

    const db = ctx.db.getReplica()
    let did: string | undefined
    const user = await ctx.services.actor(db).getActor(handle, true)
    if (user) {
      did = user.did
    } else {
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
