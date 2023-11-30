/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'
import * as ComAtprotoModerationDefs from '../moderation/defs'
import * as ComAtprotoServerDefs from '../server/defs'
import * as ComAtprotoLabelDefs from '../label/defs'

export interface StatusAttr {
  applied: boolean
  ref?: string
  [k: string]: unknown
}

export function isStatusAttr(v: unknown): v is StatusAttr {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#statusAttr'
  )
}

export function validateStatusAttr(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#statusAttr', v)
}

export interface ModEventView {
  id: number
  event:
    | ModEventTakedown
    | ModEventReverseTakedown
    | ModEventComment
    | ModEventReport
    | ModEventLabel
    | ModEventAcknowledge
    | ModEventEscalate
    | ModEventMute
    | ModEventEmail
    | { $type: string; [k: string]: unknown }
  subject:
    | RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids: string[]
  createdBy: string
  createdAt: string
  creatorHandle?: string
  subjectHandle?: string
  [k: string]: unknown
}

export function isModEventView(v: unknown): v is ModEventView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventView'
  )
}

export function validateModEventView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventView', v)
}

export interface ModEventViewDetail {
  id: number
  event:
    | ModEventTakedown
    | ModEventReverseTakedown
    | ModEventComment
    | ModEventReport
    | ModEventLabel
    | ModEventAcknowledge
    | ModEventEscalate
    | ModEventMute
    | { $type: string; [k: string]: unknown }
  subject:
    | RepoView
    | RepoViewNotFound
    | RecordView
    | RecordViewNotFound
    | { $type: string; [k: string]: unknown }
  subjectBlobs: BlobView[]
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export function isModEventViewDetail(v: unknown): v is ModEventViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventViewDetail'
  )
}

export function validateModEventViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventViewDetail', v)
}

export interface ReportView {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  comment?: string
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

export interface SubjectStatusView {
  id: number
  subject:
    | RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  subjectRepoHandle?: string
  /** Timestamp referencing when the last update was made to the moderation status of the subject */
  updatedAt: string
  /** Timestamp referencing the first moderation status impacting event was emitted on the subject */
  createdAt: string
  reviewState: SubjectReviewState
  /** Sticky comment on the subject. */
  comment?: string
  muteUntil?: string
  lastReviewedBy?: string
  lastReviewedAt?: string
  lastReportedAt?: string
  takendown?: boolean
  suspendUntil?: string
  [k: string]: unknown
}

export function isSubjectStatusView(v: unknown): v is SubjectStatusView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#subjectStatusView'
  )
}

export function validateSubjectStatusView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#subjectStatusView', v)
}

export interface ReportViewDetail {
  id: number
  reasonType: ComAtprotoModerationDefs.ReasonType
  comment?: string
  subject:
    | RepoView
    | RepoViewNotFound
    | RecordView
    | RecordViewNotFound
    | { $type: string; [k: string]: unknown }
  subjectStatus?: SubjectStatusView
  reportedBy: string
  createdAt: string
  resolvedByActions: ModEventView[]
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
  emailConfirmedAt?: string
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

export interface AccountView {
  did: string
  handle: string
  email?: string
  indexedAt: string
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invites?: ComAtprotoServerDefs.InviteCode[]
  invitesDisabled?: boolean
  emailConfirmedAt?: string
  inviteNote?: string
  [k: string]: unknown
}

export function isAccountView(v: unknown): v is AccountView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#accountView'
  )
}

export function validateAccountView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#accountView', v)
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

export interface RepoBlobRef {
  did: string
  cid: string
  recordUri?: string
  [k: string]: unknown
}

export function isRepoBlobRef(v: unknown): v is RepoBlobRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoBlobRef'
  )
}

export function validateRepoBlobRef(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoBlobRef', v)
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
  subjectStatus?: SubjectStatusView
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
  subjectStatus?: SubjectStatusView
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

export type SubjectReviewState =
  | 'lex:com.atproto.admin.defs#reviewOpen'
  | 'lex:com.atproto.admin.defs#reviewEscalated'
  | 'lex:com.atproto.admin.defs#reviewClosed'
  | (string & {})

/** Moderator review status of a subject: Open. Indicates that the subject needs to be reviewed by a moderator */
export const REVIEWOPEN = 'com.atproto.admin.defs#reviewOpen'
/** Moderator review status of a subject: Escalated. Indicates that the subject was escalated for review by a moderator */
export const REVIEWESCALATED = 'com.atproto.admin.defs#reviewEscalated'
/** Moderator review status of a subject: Closed. Indicates that the subject was already reviewed and resolved by a moderator */
export const REVIEWCLOSED = 'com.atproto.admin.defs#reviewClosed'

/** Take down a subject permanently or temporarily */
export interface ModEventTakedown {
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
  [k: string]: unknown
}

export function isModEventTakedown(v: unknown): v is ModEventTakedown {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventTakedown'
  )
}

export function validateModEventTakedown(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventTakedown', v)
}

/** Revert take down action on a subject */
export interface ModEventReverseTakedown {
  /** Describe reasoning behind the reversal. */
  comment?: string
  [k: string]: unknown
}

export function isModEventReverseTakedown(
  v: unknown,
): v is ModEventReverseTakedown {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventReverseTakedown'
  )
}

export function validateModEventReverseTakedown(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventReverseTakedown', v)
}

/** Add a comment to a subject */
export interface ModEventComment {
  comment: string
  /** Make the comment persistent on the subject */
  sticky?: boolean
  [k: string]: unknown
}

export function isModEventComment(v: unknown): v is ModEventComment {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventComment'
  )
}

export function validateModEventComment(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventComment', v)
}

/** Report a subject */
export interface ModEventReport {
  comment?: string
  reportType: ComAtprotoModerationDefs.ReasonType
  [k: string]: unknown
}

export function isModEventReport(v: unknown): v is ModEventReport {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventReport'
  )
}

export function validateModEventReport(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventReport', v)
}

/** Apply/Negate labels on a subject */
export interface ModEventLabel {
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
  [k: string]: unknown
}

export function isModEventLabel(v: unknown): v is ModEventLabel {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventLabel'
  )
}

export function validateModEventLabel(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventLabel', v)
}

export interface ModEventAcknowledge {
  comment?: string
  [k: string]: unknown
}

export function isModEventAcknowledge(v: unknown): v is ModEventAcknowledge {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventAcknowledge'
  )
}

export function validateModEventAcknowledge(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventAcknowledge', v)
}

export interface ModEventEscalate {
  comment?: string
  [k: string]: unknown
}

export function isModEventEscalate(v: unknown): v is ModEventEscalate {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventEscalate'
  )
}

export function validateModEventEscalate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventEscalate', v)
}

/** Mute incoming reports on a subject */
export interface ModEventMute {
  comment?: string
  /** Indicates how long the subject should remain muted. */
  durationInHours: number
  [k: string]: unknown
}

export function isModEventMute(v: unknown): v is ModEventMute {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventMute'
  )
}

export function validateModEventMute(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventMute', v)
}

/** Unmute action on a subject */
export interface ModEventUnmute {
  /** Describe reasoning behind the reversal. */
  comment?: string
  [k: string]: unknown
}

export function isModEventUnmute(v: unknown): v is ModEventUnmute {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventUnmute'
  )
}

export function validateModEventUnmute(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventUnmute', v)
}

/** Keep a log of outgoing email to a user */
export interface ModEventEmail {
  /** The subject line of the email sent to the user. */
  subjectLine: string
  [k: string]: unknown
}

export function isModEventEmail(v: unknown): v is ModEventEmail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#modEventEmail'
  )
}

export function validateModEventEmail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#modEventEmail', v)
}
