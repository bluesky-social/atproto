import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { baseNormalizeAndValidate } from '../../../../handle'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ params, req }) => {
    const handle = baseNormalizeAndValidate(params.handle)

    let did: string | undefined
    const user = await ctx.accountManager.getAccount(handle)

    if (user) {
      did = user.did
    } else {
      const supportedHandle = ctx.cfg.identity.serviceHandleDomains.some(
        (host) => handle.endsWith(host) || handle === host.slice(1),
      )
      // this should be in our DB & we couldn't find it, so fail
      if (supportedHandle) {
        throw new InvalidRequestError('Unable to resolve handle')
      }
    }

    // this is not someone on our server, but we help with resolving anyway
    if (!did) {
      did = await ctx.appViewAgent?.com.atproto.identity
        .resolveHandle(
          { handle },
          { headers: { 'cache-control': req.headers['cache-control'] } },
        )
        .then(
          (r) => r.data.did,
          () => undefined, // ignore errors
        )
    }

    if (!did) {
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
