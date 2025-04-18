import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { baseNormalizeAndValidate } from '../../../../handle'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ params }) => {
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
