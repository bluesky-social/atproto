import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.handle.resolve(async ({ params }) => {
    const handle = params.handle

    let did = ''
    if (!handle || handle === ctx.cfg.publicHostname) {
      // self
      did = ctx.cfg.serverDid
    } else {
      const supportedHandle = ctx.cfg.availableUserDomains.some((host) =>
        handle.endsWith(host),
      )
      if (!supportedHandle) {
        throw new InvalidRequestError('Not a supported handle domain')
      }
      const user = await ctx.services.actor(ctx.db).getUser(handle, true)
      if (!user) {
        throw new InvalidRequestError('Unable to resolve handle')
      }
      did = user.did
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })
}
