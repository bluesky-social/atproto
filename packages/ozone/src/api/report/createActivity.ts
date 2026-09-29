import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import {
  createReportActivity,
  formatActivityView,
  isActivityType,
} from '../../report/activity.js'
import { getAuthDid } from '../util.js'

const DEFS_PREFIX = 'tools.ozone.report.defs#'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.report.createActivity, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const createdBy = getAuthDid(auth, ctx.cfg.service.did)
      const {
        reportId,
        eventId,
        activity,
        internalNote,
        publicNote,
        isAutomated,
      } = input.body

      if ((reportId === undefined) === (eventId === undefined)) {
        throw new InvalidRequestError(
          'Exactly one of reportId or eventId must be provided',
        )
      }

      const rawType = activity.$type
      const activityType = rawType?.startsWith(DEFS_PREFIX)
        ? rawType.slice(DEFS_PREFIX.length)
        : rawType

      if (!isActivityType(activityType)) {
        throw new InvalidRequestError(
          `Unknown activity type: ${rawType}`,
          'InvalidActivityType',
        )
      }

      const row = await createReportActivity(ctx.db, {
        reportId,
        eventId,
        activityType,
        internalNote: internalNote ?? undefined,
        publicNote: publicNote ?? undefined,
        isAutomated: isAutomated ?? false,
        createdBy: createdBy ?? ctx.cfg.service.did,
      })

      return {
        encoding: 'application/json',
        body: { activity: formatActivityView(row) },
      }
    },
  })
}
