import { com, tools } from '../lexicons/index.js'
import type { ModerationEventRow } from '../mod-service/types.js'

type ActionEvent = Pick<
  ModerationEventRow,
  | 'action'
  | 'subjectType'
  | 'durationInHours'
  | 'createLabelVals'
  | 'negateLabelVals'
>

/** Map an event into its public action without loading any private event data. */
export function publicActionType(row: ActionEvent): string | null {
  switch (row.action) {
    case tools.ozone.moderation.defs.modEventTakedown.$type:
      if (row.subjectType !== com.atproto.admin.defs.repoRef.$type)
        return 'contentRemoved'
      return row.durationInHours ? 'accountSuspended' : 'accountTakedown'
    case tools.ozone.moderation.defs.modEventLabel.$type:
      if (row.createLabelVals?.trim()) return 'labelApplied'
      return row.negateLabelVals?.trim() ? 'labelRemoved' : null
    case tools.ozone.moderation.defs.modEventEmail.$type:
      return 'communicationSent'
    case tools.ozone.moderation.defs.modEventMuteReporter.$type:
      return 'reportingRestricted'
    case tools.ozone.moderation.defs.revokeAccountCredentialsEvent.$type:
      return 'credentialsRevoked'
    default:
      return null
  }
}
