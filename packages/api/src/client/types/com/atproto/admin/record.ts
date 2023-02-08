/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoAdminRepo from './repo'
import * as ComAtprotoAdminBlob from './blob'
import * as ComAtprotoAdminModerationAction from './moderationAction'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  uri: string
  cid: string
  value: {}
  blobCids: string[]
  indexedAt: string
  moderation: Moderation
  repo: ComAtprotoAdminRepo.View
  [k: string]: unknown
}

export interface ViewDetail {
  uri: string
  cid: string
  value: {}
  blobs: ComAtprotoAdminBlob.View[]
  indexedAt: string
  moderation: ModerationDetail
  repo: ComAtprotoAdminRepo.View
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
