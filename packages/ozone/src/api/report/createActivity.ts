import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { createReportActivity, formatActivityView } from '../../report/activity'
import { getAuthDid } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.createActivity({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const createdBy = getAuthDid(auth, ctx.cfg.service.did)
      const { reportId, action, toState, note, updateStatus } = input.body

      const activity = await createReportActivity(ctx.db, {
        reportId,
        action,
        toState: toState ?? undefined,
        note: note ?? undefined,
        updateStatus: updateStatus ?? true,
        isAutomated: false,
        createdBy: createdBy ?? ctx.cfg.service.did,
      })

      return {
        encoding: 'application/json',
        body: { activity: formatActivityView(activity) },
      }
    },
  })
}
