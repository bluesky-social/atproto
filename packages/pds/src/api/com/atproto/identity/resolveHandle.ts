import * as ident from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ params }) => {
    let handle: string
    try {
      handle = ident.normalizeAndEnsureValidHandle(params.handle)
    } catch (err) {
      if (err instanceof ident.InvalidHandleError) {
        throw new InvalidRequestError(err.message, 'InvalidHandle')
      } else {
        throw err
      }
    }

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
    if (!did && ctx.bskyAppView) {
      try {
        const result =
          await ctx.bskyAppView.agent.com.atproto.identity.resolveHandle({
            handle,
          })
        did = result.data.did
      } catch {
        // Ignore
      }
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
