import type { GeneratedAlways } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'

export const scheduledActionTableName = 'scheduled_action'

export interface ScheduledAction {
  id: GeneratedAlways<number>
  action: string
  eventData: unknown | null
  did: DidString
  executeAt: DatetimeString | null
  executeAfter: DatetimeString | null
  executeUntil: DatetimeString | null
  randomizeExecution: boolean
  createdBy: DidString
  createdAt: DatetimeString
  updatedAt: DatetimeString
  status: string
  lastExecutedAt: DatetimeString | null
  lastFailureReason: string | null
  executionEventId: number | null
}

export type PartialDB = {
  [scheduledActionTableName]: ScheduledAction
}
