import type { DidString } from '@atproto/lex'
import type { ScheduledActionType } from '../api/util.js'
import type { tools } from '../lexicons/index.js'

export type ScheduledTakedownEventData =
  tools.ozone.moderation.scheduleAction.Takedown & {
    modTool?: tools.ozone.moderation.defs.ModTool
    reportEventId?: number
  }

export type ExecutionSchedule =
  | {
      executeAt: Date
    }
  | {
      executeAfter: Date
      executeUntil?: Date
    }

export type SchedulingParams = {
  action: ScheduledActionType
  eventData: unknown
  did: DidString
  createdBy: DidString
} & ExecutionSchedule
