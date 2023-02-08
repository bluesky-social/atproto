/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
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

export function isView(v: unknown): v is View {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationReport#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationReport#view', v)
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

export function isViewDetail(v: unknown): v is ViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationReport#viewDetail'
  )
}

export function validateViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationReport#viewDetail', v)
}
