import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.team.listMembers({
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
