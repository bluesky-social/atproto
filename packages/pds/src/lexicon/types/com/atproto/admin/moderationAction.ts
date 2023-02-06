/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'
import * as ComAtprotoAdminRepo from './repo'
import * as ComAtprotoAdminRecord from './record'
import * as ComAtprotoAdminBlob from './blob'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  id: number
  action: ActionType
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids: string[]
  reason: string
  createdBy: string
  createdAt: string
  reversal?: Reversal
  resolvedReportIds: number[]
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#view', v)
}

export interface ViewDetail {
  id: number
  action: ActionType
  subject:
    | ComAtprotoAdminRepo.View
    | ComAtprotoAdminRecord.View
    | { $type: string; [k: string]: unknown }
  subjectBlobs: ComAtprotoAdminBlob.View[]
  reason: string
  createdBy: string
  createdAt: string
  reversal?: Reversal
  resolvedReports: ComAtprotoAdminModerationReport.View[]
  [k: string]: unknown
}

export function isViewDetail(v: unknown): v is ViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#viewDetail'
  )
}

export function validateViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#viewDetail', v)
}

export interface ViewCurrent {
  id: number
  action: ActionType
  [k: string]: unknown
}

export function isViewCurrent(v: unknown): v is ViewCurrent {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#viewCurrent'
  )
}

export function validateViewCurrent(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#viewCurrent', v)
}

export interface Reversal {
  reason: string
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export function isReversal(v: unknown): v is Reversal {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#reversal'
  )
}

export function validateReversal(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#reversal', v)
}

export type ActionType =
  | 'com.atproto.admin.moderationAction#takedown'
  | 'com.atproto.admin.moderationAction#flag'
  | 'com.atproto.admin.moderationAction#acknowledge'
  | (string & {})

/** Moderation action type: Takedown. Indicates that content should not be served by the PDS. */
export const TAKEDOWN = 'com.atproto.admin.moderationAction#takedown'
/** Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served. */
export const FLAG = 'com.atproto.admin.moderationAction#flag'
/** Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules. */
export const ACKNOWLEDGE = 'com.atproto.admin.moderationAction#acknowledge'
