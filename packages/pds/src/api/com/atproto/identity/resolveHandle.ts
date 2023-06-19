import { AtpAgent } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

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
    }

    // this is not someone on our server, but we help with resolving anyway

    if (!did && ctx.cfg.bskyAppViewEndpoint) {
      did = await tryResolveFromAppview(ctx.appviewAgent, handle)
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

async function tryResolveFromAppview(agent: AtpAgent, handle: string) {
  try {
    const result = await agent.api.com.atproto.identity.resolveHandle({
      handle,
    })
    return result.data.did
  } catch (_err) {
    return
  }
}
