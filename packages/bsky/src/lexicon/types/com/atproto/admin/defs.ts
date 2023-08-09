/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'
import * as ComAtprotoModerationDefs from '../moderation/defs'
import * as ComAtprotoServerDefs from '../server/defs'
import * as ComAtprotoLabelDefs from '../label/defs'

export interface ActionView {
  id: number
  action: ActionType
  /** Indicates how long this action was meant to be in effect before automatically expiring. */
  durationInHours?: number
  subject:
    | RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids: string[]
  createLabelVals?: string[]
  negateLabelVals?: string[]
  reason: string
  createdBy: string
  createdAt: string
  reversal?: ActionReversal
  resolvedReportIds: number[]
  [k: string]: unknown
}

export function isActionView(v: unknown): v is ActionView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#actionView'
  )
}

export function validateActionView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#actionView', v)
}

export interface ActionViewDetail {
  id: number
  action: ActionType
  /** Indicates how long this action was meant to be in effect before automatically expiring. */
  durationInHours?: number
  subject:
    | RepoView
    | RepoViewNotFound
    | RecordView
    | RecordViewNotFound
    | { $type: string; [k: string]: unknown }
  subjectBlobs: BlobView[]
  createLabelVals?: string[]
  negateLabelVals?: string[]
  reason: string
  createdBy: string
  createdAt: string
  reversal?: ActionReversal
  resolvedReports: ReportView[]
  [k: string]: unknown
}

export function isActionViewDetail(v: unknown): v is ActionViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#actionViewDetail'
  )
}

export function validateActionViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#actionViewDetail', v)
}

export interface ActionViewCurrent {
  id: number
  action: ActionType
  /** Indicates how long this action was meant to be in effect before automatically expiring. */
  durationInHours?: number
  [k: string]: unknown
}

export function isActionViewCurrent(v: unknown): v is ActionViewCurrent {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#actionViewCurrent'
  )
}

export function validateActionViewCurrent(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#actionViewCurrent', v)
}

export interface ActionReversal {
  reason: string
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export function isActionReversal(v: unknown): v is ActionReversal {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#actionReversal'
  )
}

export function validateActionReversal(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#actionReversal', v)
}

export type ActionType =
  | 'lex:com.atproto.admin.defs#takedown'
  | 'lex:com.atproto.admin.defs#flag'
  | 'lex:com.atproto.admin.defs#acknowledge'
  | 'lex:com.atproto.admin.defs#escalate'
  | (string & {})

/** Moderation action type: Takedown. Indicates that content should not be served by the PDS. */
export const TAKEDOWN = 'com.atproto.admin.defs#takedown'
/** Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served. */
export const FLAG = 'com.atproto.admin.defs#flag'
/** Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules. */
export const ACKNOWLEDGE = 'com.atproto.admin.defs#acknowledge'
/** Moderation action type: Escalate. Indicates that the content has been flagged for additional review. */
export const ESCALATE = 'com.atproto.admin.defs#escalate'

export interface ReportView {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason?: string
  subjectRepoHandle?: string
  subject:
    | RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  reportedBy: string
  createdAt: string
  resolvedByActionIds: number[]
  [k: string]: unknown
}

export function isReportView(v: unknown): v is ReportView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#reportView'
  )
}

export function validateReportView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#reportView', v)
}

export interface ReportViewDetail {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason?: string
  subject:
    | RepoView
    | RepoViewNotFound
    | RecordView
    | RecordViewNotFound
    | { $type: string; [k: string]: unknown }
  reportedBy: string
  createdAt: string
  resolvedByActions: ActionView[]
  [k: string]: unknown
}

export function isReportViewDetail(v: unknown): v is ReportViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#reportViewDetail'
  )
}

export function validateReportViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#reportViewDetail', v)
}

export interface RepoView {
  did: string
  handle: string
  email?: string
  relatedRecords: {}[]
  indexedAt: string
  moderation: Moderation
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invitesDisabled?: boolean
  inviteNote?: string
  [k: string]: unknown
}

export function isRepoView(v: unknown): v is RepoView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoView'
  )
}

export function validateRepoView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoView', v)
}

export interface RepoViewDetail {
  did: string
  handle: string
  email?: string
  relatedRecords: {}[]
  indexedAt: string
  moderation: ModerationDetail
  labels?: ComAtprotoLabelDefs.Label[]
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invites?: ComAtprotoServerDefs.InviteCode[]
  invitesDisabled?: boolean
  inviteNote?: string
  [k: string]: unknown
}

export function isRepoViewDetail(v: unknown): v is RepoViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoViewDetail'
  )
}

export function validateRepoViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoViewDetail', v)
}

export interface RepoViewNotFound {
  did: string
  [k: string]: unknown
}

export function isRepoViewNotFound(v: unknown): v is RepoViewNotFound {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoViewNotFound'
  )
}

export function validateRepoViewNotFound(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoViewNotFound', v)
}

export interface RepoRef {
  did: string
  [k: string]: unknown
}

export function isRepoRef(v: unknown): v is RepoRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoRef'
  )
}

export function validateRepoRef(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoRef', v)
}

export interface RecordView {
  uri: string
  cid: string
  value: {}
  blobCids: string[]
  indexedAt: string
  moderation: Moderation
  repo: RepoView
  [k: string]: unknown
}

export function isRecordView(v: unknown): v is RecordView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#recordView'
  )
}

export function validateRecordView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#recordView', v)
}

export interface RecordViewDetail {
  uri: string
  cid: string
  value: {}
  blobs: BlobView[]
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
  moderation: ModerationDetail
  repo: RepoView
  [k: string]: unknown
}

export function isRecordViewDetail(v: unknown): v is RecordViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#recordViewDetail'
  )
}

export function validateRecordViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#recordViewDetail', v)
}

export interface RecordViewNotFound {
  uri: string
  [k: string]: unknown
}

export function isRecordViewNotFound(v: unknown): v is RecordViewNotFound {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#recordViewNotFound'
  )
}

export function validateRecordViewNotFound(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#recordViewNotFound', v)
}

export interface Moderation {
  currentAction?: ActionViewCurrent
  [k: string]: unknown
}

export function isModeration(v: unknown): v is Moderation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#moderation'
  )
}

export function validateModeration(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#moderation', v)
}

export interface ModerationDetail {
  currentAction?: ActionViewCurrent
  actions: ActionView[]
  reports: ReportView[]
  [k: string]: unknown
}

export function isModerationDetail(v: unknown): v is ModerationDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#moderationDetail'
  )
}

export function validateModerationDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#moderationDetail', v)
}

export interface BlobView {
  cid: string
  mimeType: string
  size: number
  createdAt: string
  details?:
    | ImageDetails
    | VideoDetails
    | { $type: string; [k: string]: unknown }
  moderation?: Moderation
  [k: string]: unknown
}

export function isBlobView(v: unknown): v is BlobView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#blobView'
  )
}

export function validateBlobView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#blobView', v)
}

export interface ImageDetails {
  width: number
  height: number
  [k: string]: unknown
}

export function isImageDetails(v: unknown): v is ImageDetails {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#imageDetails'
  )
}

export function validateImageDetails(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#imageDetails', v)
}

export interface VideoDetails {
  width: number
  height: number
  length: number
  [k: string]: unknown
}

export function isVideoDetails(v: unknown): v is VideoDetails {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#videoDetails'
  )
}

export function validateVideoDetails(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#videoDetails', v)
}
