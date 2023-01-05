/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoReportReasonType from '../report/reasonType'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'
import * as ComAtprotoAdminRepo from './repo'
import * as ComAtprotoAdminRecord from './record'
import * as ComAtprotoAdminModerationAction from './moderationAction'

export interface View {
  id: number
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  reportedByDid: string
  createdAt: string
  resolvedByActionIds: number[]
  [k: string]: unknown
}

export interface ViewDetail {
  id: number
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoAdminRepo.View
    | ComAtprotoAdminRecord.View
    | { $type: string; [k: string]: unknown }
  reportedByDid: string
  createdAt: string
  resolvedByActions: ComAtprotoAdminModerationAction.View[]
  [k: string]: unknown
}
