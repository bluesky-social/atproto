import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.team.listMembers, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const teamService = ctx.teamService(ctx.db)
      const { members, cursor } = await teamService.list(params)

      return {
        encoding: 'application/json',
        body: {
          cursor,
          members: await teamService.view(members),
        },
      }
    },
  })
}
