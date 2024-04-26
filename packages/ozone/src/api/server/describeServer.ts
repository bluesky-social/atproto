import { Server } from '../../lexicon'
import AppContext from '../../context'
import { ToolsOzoneServerDescribeServer } from '@atproto/api'
import { getHandle } from '@atproto/identity'

const moderatorsCache: Map<string, ToolsOzoneServerDescribeServer.Moderator> =
  new Map()

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.server.describeServer({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async () => {
      const getModeratorDetails = async (
        did: string,
        role: ToolsOzoneServerDescribeServer.Moderator['role'],
      ) => {
        const fromCache = moderatorsCache.get(did)
        if (fromCache) {
          return fromCache
        }

        const didDoc = await ctx.idResolver.did.resolve(did)

        const handle = didDoc ? getHandle(didDoc) : undefined
        const details = { handle, did, role }
        moderatorsCache.set(did, details)
        return details
      }
      const moderators: ToolsOzoneServerDescribeServer.Moderator[] =
        await Promise.all([
          ...ctx.cfg.access.admins.map((did) =>
            getModeratorDetails(did, 'admin'),
          ),
          ...ctx.cfg.access.moderators.map((did) =>
            getModeratorDetails(did, 'moderator'),
          ),
          ...ctx.cfg.access.triage.map((did) =>
            getModeratorDetails(did, 'triage'),
          ),
        ])

      return {
        encoding: 'application/json',
        body: {
          moderators,
          did: ctx.cfg.service.did,
        },
      }
    },
  })
}
