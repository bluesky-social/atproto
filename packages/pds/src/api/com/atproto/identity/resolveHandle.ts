import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { resolveExternalHandle } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
    const handle = ident.normalizeHandle(params.handle || req.hostname)

    let did: string | undefined
    const user = await ctx.services.account(ctx.db).getAccount(handle, true)
    if (user) {
      did = user.did
    } else {
      const supportedHandle = ctx.cfg.availableUserDomains.some(
        (host) => handle.endsWith(host) || handle === host.slice(1),
      )
      // this should be in our DB & we couldn't find it, so fail
      if (supportedHandle) {
        throw new InvalidRequestError('Unable to resolve handle')
      }

      // this is not someone on our server, but we help with resolving anyway
      did = await resolveExternalHandle(ctx.cfg.scheme, handle)
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
