import { readSpaceMetaStar } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, throwInvalidArchive } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.importSpaceMeta, {
    opts: {
      blobLimit: ctx.cfg.service.maxImportSize,
    },
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: () => {
        // Performed in the handler as it requires the archive's space
      },
    }),
    handler: async ({ input, auth }) => {
      if (!ctx.cfg.service.acceptingImports) {
        throw new InvalidRequestError('Service is not accepting repo imports')
      }

      const archive = await readSpaceMetaStar(input.body).catch(
        throwInvalidArchive,
      )

      // Importing both creates the space on this host and sets its configuration.
      assertSpaceOwner(auth, archive.space, { manage: 'create' })
      assertSpaceOwner(auth, archive.space, { manage: 'update' })

      await ctx.spacePolicyManager.importSpaceMeta(archive)
    },
  })
}
