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
  did: string
  createdBy: string
} & ExecutionSchedule
