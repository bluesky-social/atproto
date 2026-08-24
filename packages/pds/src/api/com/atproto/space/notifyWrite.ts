import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { processNotifyWrite, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyWrite, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, repo, rev, hash } = input.body

      const { spaceDid: ownerDid } = toSpaceRef(space)

      // iss is the signer, so requiring it to match keeps a PDS from notifying on
      // another account's behalf.
      if (auth.credentials.iss !== repo) {
        throw new ForbiddenError(
          'notifyWrite iss does not match claimed writer',
        )
      }

      // Not checked during auth: a PDS answers for many authorities, so the
      // audience is only knowable from the space the body names.
      if (auth.credentials.aud !== ownerDid) {
        throw new ForbiddenError(
          'notifyWrite aud does not match the space authority',
        )
      }

      await processNotifyWrite(ctx, { space, repo, rev, hash })
    },
  })
}
