import { isDidString } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { baseNormalizeAndValidate } from '../../../../handle/index.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
    const handle = baseNormalizeAndValidate(params.handle)

    // when behind an entryway, the entryway is authoritative for handles
    // rather than this pds' local accounts
    if (!ctx.cfg.entryway) {
      const user = await ctx.accountManager.getAccount(handle)
      if (user) {
        return {
          encoding: 'application/json' as const,
          body: { did: user.did as DidString },
        }
      }

      const supportedHandle = ctx.cfg.identity.serviceHandleDomains.some(
        (host) => handle.endsWith(host) || handle === host.slice(1),
      )
      // this should be in our DB & we couldn't find it, so fail
      if (supportedHandle) {
        throw new InvalidRequestError('Unable to resolve handle')
      }
    }

    const did: DidString = ctx.bskyAppView
      ? await ctx.bskyAppView.client
          .call(com.atproto.identity.resolveHandle, { handle })
          .then((r) => r.did, throwInvalidRequestError)
      : await ctx.idResolver.handle
          .resolve(handle)
          .then(
            (v) => (v && isDidString(v) ? v : throwInvalidRequestError()),
            throwInvalidRequestError,
          )

    return {
      encoding: 'application/json' as const,
      body: { did },
    }
  })
}

function throwInvalidRequestError(cause?: unknown): never {
  throw new InvalidRequestError('Unable to resolve handle', undefined, {
    cause,
  })
}
