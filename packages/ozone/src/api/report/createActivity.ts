import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  ActivityType,
  createReportActivity,
  formatActivityView,
} from '../../report/activity'
import { getAuthDid } from '../util'

const VALID_ACTIVITY_TYPES = new Set<ActivityType>([
  'queueActivity',
  'assignmentActivity',
  'escalationActivity',
  'closeActivity',
  'reopenActivity',
  'noteActivity',
])

const DEFS_PREFIX = 'tools.ozone.report.defs#'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.createActivity({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const createdBy = getAuthDid(auth, ctx.cfg.service.did)
      const { reportId, activity, internalNote, publicNote, isAutomated } =
        input.body

      const rawType = activity.$type ?? ''
      const activityType = rawType.startsWith(DEFS_PREFIX)
        ? rawType.slice(DEFS_PREFIX.length)
        : rawType

      if (!VALID_ACTIVITY_TYPES.has(activityType as ActivityType)) {
        throw new InvalidRequestError(
          `Unknown activity type: ${rawType}`,
          'InvalidActivityType',
        )
      }

      const row = await createReportActivity(ctx.db, {
        reportId,
        activityType: activityType as ActivityType,
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
