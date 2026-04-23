import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getReportById } from '../../mod-service/report'
import { buildReportView, hydrateReportInfo } from '../../report/views'
import { getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getReport({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      const report = await getReportById(db, params.id)
      if (!report) {
        throw new InvalidRequestError(
          `Report not found: ${params.id}`,
          'NotFound',
        )
      }

      const queueService = ctx.queueService(db)
      const teamService = ctx.teamService(db)
      const [hydrated, actionEvents] = await Promise.all([
        hydrateReportInfo(
          [report],
          modService.views,
          (dids) => getPdsAccountInfos(ctx, dids),
          (queueIds) => queueService.getViewsByIds(queueIds),
          (dids) => teamService.viewByDids(dids),
          labelers,
        ),
        Array.isArray(report.actionEventIds) && report.actionEventIds.length
          ? modService.getEventsByIds(report.actionEventIds as number[])
          : Promise.resolve([]),
      ])

      const actions = actionEvents.map((evt) =>
        modService.views.formatEvent(evt),
      )

      return {
        encoding: 'application/json',
        body: buildReportView(
          report,
          hydrated,
          auth.credentials.isModerator,
          actions,
        ),
      }
    },
  })
}
