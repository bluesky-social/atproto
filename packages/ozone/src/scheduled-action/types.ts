import { ScheduledActionType } from '../api/util'

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
