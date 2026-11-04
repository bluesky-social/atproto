import { spaceHostAud } from '@atproto/space'
import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { processNotifyRepoUpdate, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyRepoUpdate, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, repo, repoRev, data } = input.body

      const { spaceDid } = toSpaceRef(space)

      // iss is the signer, so requiring it to match keeps a PDS from notifying on
      // another account's behalf.
      if (auth.credentials.iss !== repo) {
        throw new ForbiddenError('Notification iss does not match the repo')
      }

      // Not checked during auth: a PDS answers for many authorities, so the
      // audience is only knowable from the space the body names.
      if (
        auth.credentials.aud !== spaceDid &&
        auth.credentials.aud !== spaceHostAud(spaceDid)
      ) {
        throw new ForbiddenError(
          'Notification aud does not match the space authority',
        )
      }

      await processNotifyRepoUpdate(ctx, { space, repo, repoRev, data })
    },
  })
}
