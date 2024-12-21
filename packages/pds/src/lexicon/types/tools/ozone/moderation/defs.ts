/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as ChatBskyConvoDefs from '../../../chat/bsky/convo/defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'
import * as ComAtprotoServerDefs from '../../../com/atproto/server/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const id = 'tools.ozone.moderation.defs'

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
    | ModEventUnmute
    | ModEventMuteReporter
    | ModEventUnmuteReporter
    | ModEventEmail
    | ModEventResolveAppeal
    | ModEventDivert
    | ModEventTag
    | AccountEvent
    | IdentityEvent
    | RecordEvent
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | ChatBskyConvoDefs.MessageRef
    | { $type: string; [k: string]: unknown }
  subjectBlobCids: string[]
  createdBy: string
  createdAt: string
  creatorHandle?: string
  subjectHandle?: string
  [k: string]: unknown
}

export function isModEventView(v: unknown): v is ModEventView & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventView'>
} {
  return is$typed(v, id, 'modEventView')
}

export function validateModEventView(v: unknown) {
  return lexicons.validate(
    `${id}#modEventView`,
    v,
  ) as ValidationResult<ModEventView>
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
    | ModEventUnmute
    | ModEventMuteReporter
    | ModEventUnmuteReporter
    | ModEventEmail
    | ModEventResolveAppeal
    | ModEventDivert
    | ModEventTag
    | AccountEvent
    | IdentityEvent
    | RecordEvent
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

export function isModEventViewDetail(v: unknown): v is ModEventViewDetail & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventViewDetail'>
} {
  return is$typed(v, id, 'modEventViewDetail')
}

export function validateModEventViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#modEventViewDetail`,
    v,
  ) as ValidationResult<ModEventViewDetail>
}

export interface SubjectStatusView {
  id: number
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  hosting?:
    | AccountHosting
    | RecordHosting
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
  muteReportingUntil?: string
  lastReviewedBy?: string
  lastReviewedAt?: string
  lastReportedAt?: string
  /** Timestamp referencing when the author of the subject appealed a moderation action */
  lastAppealedAt?: string
  takendown?: boolean
  /** True indicates that the a previously taken moderator action was appealed against, by the author of the content. False indicates last appeal was resolved by moderators. */
  appealed?: boolean
  suspendUntil?: string
  tags?: string[]
  [k: string]: unknown
}

export function isSubjectStatusView(v: unknown): v is SubjectStatusView & {
  $type: $Type<'tools.ozone.moderation.defs', 'subjectStatusView'>
} {
  return is$typed(v, id, 'subjectStatusView')
}

export function validateSubjectStatusView(v: unknown) {
  return lexicons.validate(
    `${id}#subjectStatusView`,
    v,
  ) as ValidationResult<SubjectStatusView>
}

export type SubjectReviewState =
  | 'lex:tools.ozone.moderation.defs#reviewOpen'
  | 'lex:tools.ozone.moderation.defs#reviewEscalated'
  | 'lex:tools.ozone.moderation.defs#reviewClosed'
  | 'lex:tools.ozone.moderation.defs#reviewNone'
  | (string & {})

/** Moderator review status of a subject: Open. Indicates that the subject needs to be reviewed by a moderator */
export const REVIEWOPEN = `${id}#reviewOpen`
/** Moderator review status of a subject: Escalated. Indicates that the subject was escalated for review by a moderator */
export const REVIEWESCALATED = `${id}#reviewEscalated`
/** Moderator review status of a subject: Closed. Indicates that the subject was already reviewed and resolved by a moderator */
export const REVIEWCLOSED = `${id}#reviewClosed`
/** Moderator review status of a subject: Unnecessary. Indicates that the subject does not need a review at the moment but there is probably some moderation related metadata available for it */
export const REVIEWNONE = `${id}#reviewNone`

/** Take down a subject permanently or temporarily */
export interface ModEventTakedown {
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
  /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
  acknowledgeAccountSubjects?: boolean
  [k: string]: unknown
}

export function isModEventTakedown(v: unknown): v is ModEventTakedown & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventTakedown'>
} {
  return is$typed(v, id, 'modEventTakedown')
}

export function validateModEventTakedown(v: unknown) {
  return lexicons.validate(
    `${id}#modEventTakedown`,
    v,
  ) as ValidationResult<ModEventTakedown>
}

/** Revert take down action on a subject */
export interface ModEventReverseTakedown {
  /** Describe reasoning behind the reversal. */
  comment?: string
  [k: string]: unknown
}

export function isModEventReverseTakedown(
  v: unknown,
): v is ModEventReverseTakedown & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventReverseTakedown'>
} {
  return is$typed(v, id, 'modEventReverseTakedown')
}

export function validateModEventReverseTakedown(v: unknown) {
  return lexicons.validate(
    `${id}#modEventReverseTakedown`,
    v,
  ) as ValidationResult<ModEventReverseTakedown>
}

/** Resolve appeal on a subject */
export interface ModEventResolveAppeal {
  /** Describe resolution. */
  comment?: string
  [k: string]: unknown
}

export function isModEventResolveAppeal(
  v: unknown,
): v is ModEventResolveAppeal & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventResolveAppeal'>
} {
  return is$typed(v, id, 'modEventResolveAppeal')
}

export function validateModEventResolveAppeal(v: unknown) {
  return lexicons.validate(
    `${id}#modEventResolveAppeal`,
    v,
  ) as ValidationResult<ModEventResolveAppeal>
}

/** Add a comment to a subject */
export interface ModEventComment {
  comment: string
  /** Make the comment persistent on the subject */
  sticky?: boolean
  [k: string]: unknown
}

export function isModEventComment(v: unknown): v is ModEventComment & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventComment'>
} {
  return is$typed(v, id, 'modEventComment')
}

export function validateModEventComment(v: unknown) {
  return lexicons.validate(
    `${id}#modEventComment`,
    v,
  ) as ValidationResult<ModEventComment>
}

/** Report a subject */
export interface ModEventReport {
  comment?: string
  /** Set to true if the reporter was muted from reporting at the time of the event. These reports won't impact the reviewState of the subject. */
  isReporterMuted?: boolean
  reportType: ComAtprotoModerationDefs.ReasonType
  [k: string]: unknown
}

export function isModEventReport(v: unknown): v is ModEventReport & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventReport'>
} {
  return is$typed(v, id, 'modEventReport')
}

export function validateModEventReport(v: unknown) {
  return lexicons.validate(
    `${id}#modEventReport`,
    v,
  ) as ValidationResult<ModEventReport>
}

/** Apply/Negate labels on a subject */
export interface ModEventLabel {
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
  [k: string]: unknown
}

export function isModEventLabel(v: unknown): v is ModEventLabel & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventLabel'>
} {
  return is$typed(v, id, 'modEventLabel')
}

export function validateModEventLabel(v: unknown) {
  return lexicons.validate(
    `${id}#modEventLabel`,
    v,
  ) as ValidationResult<ModEventLabel>
}

export interface ModEventAcknowledge {
  comment?: string
  /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
  acknowledgeAccountSubjects?: boolean
  [k: string]: unknown
}

export function isModEventAcknowledge(v: unknown): v is ModEventAcknowledge & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventAcknowledge'>
} {
  return is$typed(v, id, 'modEventAcknowledge')
}

export function validateModEventAcknowledge(v: unknown) {
  return lexicons.validate(
    `${id}#modEventAcknowledge`,
    v,
  ) as ValidationResult<ModEventAcknowledge>
}

export interface ModEventEscalate {
  comment?: string
  [k: string]: unknown
}

export function isModEventEscalate(v: unknown): v is ModEventEscalate & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventEscalate'>
} {
  return is$typed(v, id, 'modEventEscalate')
}

export function validateModEventEscalate(v: unknown) {
  return lexicons.validate(
    `${id}#modEventEscalate`,
    v,
  ) as ValidationResult<ModEventEscalate>
}

/** Mute incoming reports on a subject */
export interface ModEventMute {
  comment?: string
  /** Indicates how long the subject should remain muted. */
  durationInHours: number
  [k: string]: unknown
}

export function isModEventMute(v: unknown): v is ModEventMute & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventMute'>
} {
  return is$typed(v, id, 'modEventMute')
}

export function validateModEventMute(v: unknown) {
  return lexicons.validate(
    `${id}#modEventMute`,
    v,
  ) as ValidationResult<ModEventMute>
}

/** Unmute action on a subject */
export interface ModEventUnmute {
  /** Describe reasoning behind the reversal. */
  comment?: string
  [k: string]: unknown
}

export function isModEventUnmute(v: unknown): v is ModEventUnmute & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventUnmute'>
} {
  return is$typed(v, id, 'modEventUnmute')
}

export function validateModEventUnmute(v: unknown) {
  return lexicons.validate(
    `${id}#modEventUnmute`,
    v,
  ) as ValidationResult<ModEventUnmute>
}

/** Mute incoming reports from an account */
export interface ModEventMuteReporter {
  comment?: string
  /** Indicates how long the account should remain muted. Falsy value here means a permanent mute. */
  durationInHours?: number
  [k: string]: unknown
}

export function isModEventMuteReporter(
  v: unknown,
): v is ModEventMuteReporter & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventMuteReporter'>
} {
  return is$typed(v, id, 'modEventMuteReporter')
}

export function validateModEventMuteReporter(v: unknown) {
  return lexicons.validate(
    `${id}#modEventMuteReporter`,
    v,
  ) as ValidationResult<ModEventMuteReporter>
}

/** Unmute incoming reports from an account */
export interface ModEventUnmuteReporter {
  /** Describe reasoning behind the reversal. */
  comment?: string
  [k: string]: unknown
}

export function isModEventUnmuteReporter(
  v: unknown,
): v is ModEventUnmuteReporter & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventUnmuteReporter'>
} {
  return is$typed(v, id, 'modEventUnmuteReporter')
}

export function validateModEventUnmuteReporter(v: unknown) {
  return lexicons.validate(
    `${id}#modEventUnmuteReporter`,
    v,
  ) as ValidationResult<ModEventUnmuteReporter>
}

/** Keep a log of outgoing email to a user */
export interface ModEventEmail {
  /** The subject line of the email sent to the user. */
  subjectLine: string
  /** The content of the email sent to the user. */
  content?: string
  /** Additional comment about the outgoing comm. */
  comment?: string
  [k: string]: unknown
}

export function isModEventEmail(v: unknown): v is ModEventEmail & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventEmail'>
} {
  return is$typed(v, id, 'modEventEmail')
}

export function validateModEventEmail(v: unknown) {
  return lexicons.validate(
    `${id}#modEventEmail`,
    v,
  ) as ValidationResult<ModEventEmail>
}

/** Divert a record's blobs to a 3rd party service for further scanning/tagging */
export interface ModEventDivert {
  comment?: string
  [k: string]: unknown
}

export function isModEventDivert(v: unknown): v is ModEventDivert & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventDivert'>
} {
  return is$typed(v, id, 'modEventDivert')
}

export function validateModEventDivert(v: unknown) {
  return lexicons.validate(
    `${id}#modEventDivert`,
    v,
  ) as ValidationResult<ModEventDivert>
}

/** Add/Remove a tag on a subject */
export interface ModEventTag {
  /** Tags to be added to the subject. If already exists, won't be duplicated. */
  add: string[]
  /** Tags to be removed to the subject. Ignores a tag If it doesn't exist, won't be duplicated. */
  remove: string[]
  /** Additional comment about added/removed tags. */
  comment?: string
  [k: string]: unknown
}

export function isModEventTag(v: unknown): v is ModEventTag & {
  $type: $Type<'tools.ozone.moderation.defs', 'modEventTag'>
} {
  return is$typed(v, id, 'modEventTag')
}

export function validateModEventTag(v: unknown) {
  return lexicons.validate(
    `${id}#modEventTag`,
    v,
  ) as ValidationResult<ModEventTag>
}

/** Logs account status related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface AccountEvent {
  comment?: string
  /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
  active: boolean
  status?:
    | 'unknown'
    | 'deactivated'
    | 'deleted'
    | 'takendown'
    | 'suspended'
    | 'tombstoned'
    | (string & {})
  timestamp: string
  [k: string]: unknown
}

export function isAccountEvent(v: unknown): v is AccountEvent & {
  $type: $Type<'tools.ozone.moderation.defs', 'accountEvent'>
} {
  return is$typed(v, id, 'accountEvent')
}

export function validateAccountEvent(v: unknown) {
  return lexicons.validate(
    `${id}#accountEvent`,
    v,
  ) as ValidationResult<AccountEvent>
}

/** Logs identity related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface IdentityEvent {
  comment?: string
  handle?: string
  pdsHost?: string
  tombstone?: boolean
  timestamp: string
  [k: string]: unknown
}

export function isIdentityEvent(v: unknown): v is IdentityEvent & {
  $type: $Type<'tools.ozone.moderation.defs', 'identityEvent'>
} {
  return is$typed(v, id, 'identityEvent')
}

export function validateIdentityEvent(v: unknown) {
  return lexicons.validate(
    `${id}#identityEvent`,
    v,
  ) as ValidationResult<IdentityEvent>
}

/** Logs lifecycle event on a record subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface RecordEvent {
  comment?: string
  op: 'create' | 'update' | 'delete' | (string & {})
  cid?: string
  timestamp: string
  [k: string]: unknown
}

export function isRecordEvent(v: unknown): v is RecordEvent & {
  $type: $Type<'tools.ozone.moderation.defs', 'recordEvent'>
} {
  return is$typed(v, id, 'recordEvent')
}

export function validateRecordEvent(v: unknown) {
  return lexicons.validate(
    `${id}#recordEvent`,
    v,
  ) as ValidationResult<RecordEvent>
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
  deactivatedAt?: string
  threatSignatures?: ComAtprotoAdminDefs.ThreatSignature[]
  [k: string]: unknown
}

export function isRepoView(
  v: unknown,
): v is RepoView & { $type: $Type<'tools.ozone.moderation.defs', 'repoView'> } {
  return is$typed(v, id, 'repoView')
}

export function validateRepoView(v: unknown) {
  return lexicons.validate(`${id}#repoView`, v) as ValidationResult<RepoView>
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
  deactivatedAt?: string
  threatSignatures?: ComAtprotoAdminDefs.ThreatSignature[]
  [k: string]: unknown
}

export function isRepoViewDetail(v: unknown): v is RepoViewDetail & {
  $type: $Type<'tools.ozone.moderation.defs', 'repoViewDetail'>
} {
  return is$typed(v, id, 'repoViewDetail')
}

export function validateRepoViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#repoViewDetail`,
    v,
  ) as ValidationResult<RepoViewDetail>
}

export interface RepoViewNotFound {
  did: string
  [k: string]: unknown
}

export function isRepoViewNotFound(v: unknown): v is RepoViewNotFound & {
  $type: $Type<'tools.ozone.moderation.defs', 'repoViewNotFound'>
} {
  return is$typed(v, id, 'repoViewNotFound')
}

export function validateRepoViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#repoViewNotFound`,
    v,
  ) as ValidationResult<RepoViewNotFound>
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

export function isRecordView(v: unknown): v is RecordView & {
  $type: $Type<'tools.ozone.moderation.defs', 'recordView'>
} {
  return is$typed(v, id, 'recordView')
}

export function validateRecordView(v: unknown) {
  return lexicons.validate(
    `${id}#recordView`,
    v,
  ) as ValidationResult<RecordView>
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

export function isRecordViewDetail(v: unknown): v is RecordViewDetail & {
  $type: $Type<'tools.ozone.moderation.defs', 'recordViewDetail'>
} {
  return is$typed(v, id, 'recordViewDetail')
}

export function validateRecordViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#recordViewDetail`,
    v,
  ) as ValidationResult<RecordViewDetail>
}

export interface RecordViewNotFound {
  uri: string
  [k: string]: unknown
}

export function isRecordViewNotFound(v: unknown): v is RecordViewNotFound & {
  $type: $Type<'tools.ozone.moderation.defs', 'recordViewNotFound'>
} {
  return is$typed(v, id, 'recordViewNotFound')
}

export function validateRecordViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#recordViewNotFound`,
    v,
  ) as ValidationResult<RecordViewNotFound>
}

export interface Moderation {
  subjectStatus?: SubjectStatusView
  [k: string]: unknown
}

export function isModeration(v: unknown): v is Moderation & {
  $type: $Type<'tools.ozone.moderation.defs', 'moderation'>
} {
  return is$typed(v, id, 'moderation')
}

export function validateModeration(v: unknown) {
  return lexicons.validate(
    `${id}#moderation`,
    v,
  ) as ValidationResult<Moderation>
}

export interface ModerationDetail {
  subjectStatus?: SubjectStatusView
  [k: string]: unknown
}

export function isModerationDetail(v: unknown): v is ModerationDetail & {
  $type: $Type<'tools.ozone.moderation.defs', 'moderationDetail'>
} {
  return is$typed(v, id, 'moderationDetail')
}

export function validateModerationDetail(v: unknown) {
  return lexicons.validate(
    `${id}#moderationDetail`,
    v,
  ) as ValidationResult<ModerationDetail>
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

export function isBlobView(
  v: unknown,
): v is BlobView & { $type: $Type<'tools.ozone.moderation.defs', 'blobView'> } {
  return is$typed(v, id, 'blobView')
}

export function validateBlobView(v: unknown) {
  return lexicons.validate(`${id}#blobView`, v) as ValidationResult<BlobView>
}

export interface ImageDetails {
  width: number
  height: number
  [k: string]: unknown
}

export function isImageDetails(v: unknown): v is ImageDetails & {
  $type: $Type<'tools.ozone.moderation.defs', 'imageDetails'>
} {
  return is$typed(v, id, 'imageDetails')
}

export function validateImageDetails(v: unknown) {
  return lexicons.validate(
    `${id}#imageDetails`,
    v,
  ) as ValidationResult<ImageDetails>
}

export interface VideoDetails {
  width: number
  height: number
  length: number
  [k: string]: unknown
}

export function isVideoDetails(v: unknown): v is VideoDetails & {
  $type: $Type<'tools.ozone.moderation.defs', 'videoDetails'>
} {
  return is$typed(v, id, 'videoDetails')
}

export function validateVideoDetails(v: unknown) {
  return lexicons.validate(
    `${id}#videoDetails`,
    v,
  ) as ValidationResult<VideoDetails>
}

export interface AccountHosting {
  status:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | 'unknown'
    | (string & {})
  updatedAt?: string
  createdAt?: string
  deletedAt?: string
  deactivatedAt?: string
  reactivatedAt?: string
  [k: string]: unknown
}

export function isAccountHosting(v: unknown): v is AccountHosting & {
  $type: $Type<'tools.ozone.moderation.defs', 'accountHosting'>
} {
  return is$typed(v, id, 'accountHosting')
}

export function validateAccountHosting(v: unknown) {
  return lexicons.validate(
    `${id}#accountHosting`,
    v,
  ) as ValidationResult<AccountHosting>
}

export interface RecordHosting {
  status: 'deleted' | 'unknown' | (string & {})
  updatedAt?: string
  createdAt?: string
  deletedAt?: string
  [k: string]: unknown
}

export function isRecordHosting(v: unknown): v is RecordHosting & {
  $type: $Type<'tools.ozone.moderation.defs', 'recordHosting'>
} {
  return is$typed(v, id, 'recordHosting')
}

export function validateRecordHosting(v: unknown) {
  return lexicons.validate(
    `${id}#recordHosting`,
    v,
  ) as ValidationResult<RecordHosting>
}
