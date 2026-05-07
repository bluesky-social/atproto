import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getReportById } from '../../mod-service/report'
import { reassignReportQueue } from '../../report/reassign'
import { buildReportView, hydrateReportInfo } from '../../report/views'
import { getAuthDid, getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.reassignQueue({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth, req }) => {
      const createdBy =
        getAuthDid(auth, ctx.cfg.service.did) ?? ctx.cfg.service.did
      const db = ctx.db
      const queueService = ctx.queueService(db)

      await reassignReportQueue(db, queueService, {
        reportId: input.body.reportId,
        toQueueId: input.body.queueId,
        comment: input.body.comment,
        createdBy,
      })

      const report = await getReportById(db, input.body.reportId)
      if (!report) {
        throw new InvalidRequestError(
          `Report ${input.body.reportId} not found after reassignment`,
          'ReportNotFound',
        )
      }

      const modService = ctx.modService(db)
      const teamService = ctx.teamService(db)
      const labelers = ctx.reqLabelers(req)

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
        body: {
          report: buildReportView(
            report,
            hydrated,
            auth.credentials.isModerator,
            actions,
          ),
        },
      }
    },
  })
}
