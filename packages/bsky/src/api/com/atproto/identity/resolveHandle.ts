import * as ident from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.identity.resolveHandle, async ({ req, params }) => {
    const handle = ident.normalizeHandle(params.handle || req.hostname)

    const [did] = await ctx.hydrator.actor.getDids([handle], {
      lookupUnidirectional: true,
    })
    if (!did) {
      throw new InvalidRequestError('Unable to resolve handle')
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })
}
