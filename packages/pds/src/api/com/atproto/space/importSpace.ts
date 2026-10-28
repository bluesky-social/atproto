import { readSpaceHostStar } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { throwInvalidArchive, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.importSpace, {
    opts: {
      blobLimit: ctx.cfg.service.maxImportSize,
    },
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'repo', action: 'manage' })
      },
    }),
    handler: async ({ input, auth }) => {
      if (!ctx.cfg.service.acceptingImports) {
        throw new InvalidRequestError('Service is not accepting repo imports')
      }

      const archive = await readSpaceHostStar(input.body).catch(
        throwInvalidArchive,
      )
      if (toSpaceRef(archive.space).spaceDid !== auth.credentials.did) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      await ctx.spacePolicyManager.importSpace(archive)
    },
  })
}
