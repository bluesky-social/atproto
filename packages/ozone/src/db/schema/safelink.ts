import { Generated, GeneratedAlways } from 'kysely'

export const safelinkTableName = 'safelink'
export const safelinkEventTableName = 'safelink_event'

export type SafelinkEventType =
  | 'tools.ozone.safelink.defs#addRule'
  | 'tools.ozone.safelink.defs#updateRule'
  | 'tools.ozone.safelink.defs#removeRule'

export type SafelinkPatternType =
  | 'tools.ozone.safelink.defs#domain'
  | 'tools.ozone.safelink.defs#url'

export type SafelinkActionType =
  | 'tools.ozone.safelink.defs#block'
  | 'tools.ozone.safelink.defs#warn'
  | 'tools.ozone.safelink.defs#whitelist'

export type SafelinkReasonType =
  | 'tools.ozone.safelink.defs#csam'
  | 'tools.ozone.safelink.defs#spam'
  | 'tools.ozone.safelink.defs#phishing'
  | 'tools.ozone.safelink.defs#none'

export interface Safelink {
  id: GeneratedAlways<number>
  url: string
  pattern: SafelinkPatternType
  action: SafelinkActionType
  reason: SafelinkReasonType
  createdBy: string
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
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
  createdAt: Generated<Date>
  comment: string | null
}

export type PartialDB = {
  [safelinkTableName]: Safelink
  [safelinkEventTableName]: SafelinkEvent
}
