import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/syntax'
import AtpAgent from '@atproto/api'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createSIWE({
    handler: async ({ input }) => {
      // console.log('CREATE SIWE WITH IDENTIFIER:', input.body.identifier)
      // const account = await ctx.accountManager.getAccount(input.body.identifier)
      // console.log('ACCOUNT:', account)
      let handle: string
      try {
        handle = ident.normalizeAndEnsureValidHandle(input.body.identifier)
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
          (host) => { console.log('HOST:', host); return handle.endsWith(host) || handle === host.slice(1) },
        )
        console.log('SUPPORTED HANDLE:', supportedHandle)
        // this should be in our DB & we couldn't find it, so fail
        if (supportedHandle) {
          throw new InvalidRequestError('Unable to resolve handle')
        }
      }
  
      // this is not someone on our server, but we help with resolving anyway
      if (!did && ctx.appViewAgent) {
        did = await tryResolveFromAppView(ctx.appViewAgent, handle)
      }
  
      if (!did) {
        did = await ctx.idResolver.handle.resolve(handle)
      }
  
      if (!did) {
        throw new InvalidRequestError('Unable to resolve handle')
      }

      console.log('DID:', did)

      if (did) {
        const siwe = await ctx.accountManager.createSIWE(did)
        return {
          encoding: 'application/json',
          body: { siweMessage: siwe },
        }
      } else
        throw new InvalidRequestError('Unable to resolve handle')
      }
  })
}

async function tryResolveFromAppView(agent: AtpAgent, handle: string) {
  try {
    const result = await agent.api.com.atproto.identity.resolveHandle({
      handle,
    })
    return result.data.did
  } catch (_err) {
    return
  }
}