import { GeneratedAlways } from 'kysely'
import {
  SafelinkActionType,
  SafelinkEventType,
  SafelinkPatternType,
  SafelinkReasonType,
} from '../../api/util'

export const safelinkRuleTableName = 'safelink_rule'
export const safelinkEventTableName = 'safelink_event'

export interface SafelinkRule {
  id: GeneratedAlways<number>
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
  createdBy: string
  createdAt: string
  updatedAt: string
  comment: string | null
}

export interface SafelinkEvent {
  id: GeneratedAlways<number>
  eventType: SafelinkEventType
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
  createdBy: string
  createdAt: string
  comment: string | null
}

export type PartialDB = {
  [safelinkRuleTableName]: SafelinkRule
  [safelinkEventTableName]: SafelinkEvent
}
