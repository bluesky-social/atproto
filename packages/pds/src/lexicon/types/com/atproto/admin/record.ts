/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoAdminRepo from './repo'
import * as ComAtprotoAdminModerationAction from './moderationAction'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  uri: string
  cid: string
  value: {}
  indexedAt: string
  moderation: Moderation
  repo: ComAtprotoAdminRepo.View
  [k: string]: unknown
}

export interface ViewDetail {
  uri: string
  cid: string
  value: {}
  indexedAt: string
  moderation: ModerationDetail
  repo: ComAtprotoAdminRepo.View
  [k: string]: unknown
}

export interface Moderation {
  takedownId?: number
  [k: string]: unknown
}

export interface ModerationDetail {
  actions?: ComAtprotoAdminModerationAction.View[]
  reports?: ComAtprotoAdminModerationReport.View[]
  takedownId?: number
  [k: string]: unknown
}
