import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.queryStatuses({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const results = await modService.getSubjectStatuses(params)
      const subjectStatuses = results.statuses.map((status) =>
        modService.views.formatSubjectStatus(status),
      )
      return {
        encoding: 'application/json',
        body: {
          cursor: results.cursor,
          subjectStatuses,
        },
      }
    },
  })
}
