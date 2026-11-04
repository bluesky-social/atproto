import { spaceHostAud } from '@atproto/space'
import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceHost, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.unregisterNotify, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, service } = input.body
      const { iss, aud } = auth.credentials
      const { spaceDid } = toSpaceRef(space)

      // Unlike registerNotify, not a space credential: one names no service, so any
      // holder could withdraw anyone's registration. Every service under a DID is
      // signed for by the same key, so the bare DID may withdraw any of them.
      const [serviceDid] = service.split('#')
      if (iss !== service && iss !== serviceDid) {
        throw new ForbiddenError(
          'unregisterNotify iss does not match the service',
        )
      }

      // Not checked during auth: a PDS answers for many authorities, so the
      // audience is only knowable from the space the body names.
      if (aud !== spaceDid && aud !== spaceHostAud(spaceDid)) {
        throw new ForbiddenError(
          'unregisterNotify aud does not match the space authority',
        )
      }

      await assertSpaceHost(ctx, space)

      await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getActiveSpacePolicy(space),
      )

      // The endpoint isn't resolved: a subscriber whose service entry has since
      // changed must still be able to withdraw. Succeeds when nothing was registered.
      await ctx.actorStore.transact(spaceDid, (actorTxn) =>
        actorTxn.space.removeCredentialRecipient(space, service),
      )
    },
  })
}
