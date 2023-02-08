/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoAdminModerationAction from './moderationAction'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  did: string
  handle: string
  account?: Account
  relatedRecords: {}[]
  indexedAt: string
  moderation: Moderation
  [k: string]: unknown
}

export interface ViewDetail {
  did: string
  handle: string
  account?: Account
  relatedRecords: {}[]
  indexedAt: string
  moderation: ModerationDetail
  [k: string]: unknown
}

export interface Account {
  email: string
  [k: string]: unknown
}

export interface Moderation {
  currentAction?: ComAtprotoAdminModerationAction.ViewCurrent
  [k: string]: unknown
}

export interface ModerationDetail {
  currentAction?: ComAtprotoAdminModerationAction.ViewCurrent
  actions: ComAtprotoAdminModerationAction.View[]
  reports: ComAtprotoAdminModerationReport.View[]
  [k: string]: unknown
}
