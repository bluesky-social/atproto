import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  if (entrywayClient) {
    server.add(com.atproto.admin.updateAccountHandle, {
      auth: ctx.authVerifier.adminToken,
      handler: async ({ input: { body } }) => {
        const { did, handle } = await ctx.accountManager.validateHandleUpdate(
          body.did,
          body.handle,
          { allowAnyValid: true },
        )

        // the pds defers to the entryway for updating the handle in the user's
        // did doc. here was just check that the handle is already
        // bidirectionally confirmed.
        //
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        //
        // @TODO if handle is taken according to this PDS, should we force-update?
        const doc = await ctx.idResolver.did
          .resolveAtprotoData(did, true)
          .catch(() => undefined)

        if (!doc || doc.handle !== handle) {
          throw new InvalidRequestError('Handle does not match DID doc')
        }

        await ctx.accountManager.updateAccountHandle(did, handle)
      },
    })
  } else {
    server.add(com.atproto.admin.updateAccountHandle, {
      auth: ctx.authVerifier.adminToken,
      handler: async ({ input: { body } }) => {
        await ctx.accountManager.updateHandle(body.did, body.handle, {
          allowAnyValid: true,
        })
      },
    })
  }
}
