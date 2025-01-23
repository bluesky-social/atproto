import { XRPCError as XRPCClientError } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { baseNormalizeAndValidate } from '../../../../handle'
import { Server } from '../../../../lexicon'
import { appViewLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.resolveHandle(async ({ params, req }) => {
    const handle = baseNormalizeAndValidate(params.handle)

    const cacheControl = req.headers['cache-control']
    const forceResolve =
      cacheControl?.includes('no-cache') || cacheControl?.includes('max-age=0')

    const did = await resolveHandle(handle, forceResolve)
    if (!did) {
      throw new InvalidRequestError('Unable to resolve handle')
    }

    return {
      encoding: 'application/json',
      body: { did },
      headers: {
        'cache-control': 'max-age=60',
      },
    }
  })

  async function resolveHandle(
    handle: string,
    forceResolve = false,
  ): Promise<string | undefined> {
    if (!forceResolve) {
      const user = await ctx.accountManager.getAccount(handle)
      if (user) return user.did
    }

    if (ctx.bskyAppView) {
      try {
        const response =
          await ctx.bskyAppView.agent.com.atproto.identity.resolveHandle(
            { handle },
            { headers: forceResolve ? { 'cache-control': 'no-cache' } : {} },
          )

        return response.data.did
      } catch (err) {
        // If the AppView tells us the handle does not resolve, no need to
        // resolve ourselves.
        if (
          err instanceof XRPCClientError &&
          err.message === 'Unable to resolve handle'
        ) {
          return undefined
        }

        // Unexpected error
        appViewLogger.error({ err, handle }, 'Failed to resolve handle')
      }
    }

    return ctx.idResolver.handle.resolve(handle)
  }
}
