import type { GeneratedAlways } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex-schema'
import type {
  SafelinkActionType,
  SafelinkEventType,
  SafelinkPatternType,
  SafelinkReasonType,
} from '../../api/util.js'

export const safelinkRuleTableName = 'safelink_rule'
export const safelinkEventTableName = 'safelink_event'

export interface SafelinkRule {
  id: GeneratedAlways<number>
  source: string
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
  createdBy: DidString
  createdAt: DatetimeString
  updatedAt: DatetimeString
  comment: string | null
}

export interface SafelinkEvent {
  id: GeneratedAlways<number>
  source: string
  eventType: SafelinkEventType
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
  createdBy: DidString
  createdAt: DatetimeString
  comment: string | null
}

export type PartialDB = {
  [safelinkRuleTableName]: SafelinkRule
  [safelinkEventTableName]: SafelinkEvent
}
