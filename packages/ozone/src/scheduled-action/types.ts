import type { DidString } from '@atproto/lex'
import type { ScheduledActionType } from '../api/util.js'

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
