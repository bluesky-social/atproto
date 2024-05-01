import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderator.listUsers({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async () => {
      const moderatorService = ctx.moderatorService(ctx.db)
      const list = await moderatorService.list()

      return {
        encoding: 'application/json',
        body: {
          cursor: '',
          users: list.map((item) => moderatorService.view(item)),
        },
      }
    },
  })
}
