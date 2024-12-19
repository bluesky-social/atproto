/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import type * as ChatBskyConvoDefs from '../../../chat/bsky/convo/defs'
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'
import type * as ComAtprotoServerDefs from '../../../com/atproto/server/defs'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'tools.ozone.moderation.defs'

export interface ModEventView {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventView'>
  id: number
  event:
    | $Typed<ModEventTakedown>
    | $Typed<ModEventReverseTakedown>
    | $Typed<ModEventComment>
    | $Typed<ModEventReport>
    | $Typed<ModEventLabel>
    | $Typed<ModEventAcknowledge>
    | $Typed<ModEventEscalate>
    | $Typed<ModEventMute>
    | $Typed<ModEventUnmute>
    | $Typed<ModEventMuteReporter>
    | $Typed<ModEventUnmuteReporter>
    | $Typed<ModEventEmail>
    | $Typed<ModEventResolveAppeal>
    | $Typed<ModEventDivert>
    | $Typed<ModEventTag>
    | $Typed<AccountEvent>
    | $Typed<IdentityEvent>
    | $Typed<RecordEvent>
    | { $type: string }
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | $Typed<ChatBskyConvoDefs.MessageRef>
    | { $type: string }
  subjectBlobCids: string[]
  createdBy: string
  createdAt: string
  creatorHandle?: string
  subjectHandle?: string
}

const hashModEventView = 'modEventView'

export function isModEventView<V>(v: V) {
  return is$typed(v, id, hashModEventView)
}

export function validateModEventView<V>(v: V) {
  return validate<ModEventView & V>(v, id, hashModEventView)
}

export function isValidModEventView<V>(v: V) {
  return isValid<ModEventView>(v, id, hashModEventView)
}

export interface ModEventViewDetail {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventViewDetail'>
  id: number
  event:
    | $Typed<ModEventTakedown>
    | $Typed<ModEventReverseTakedown>
    | $Typed<ModEventComment>
    | $Typed<ModEventReport>
    | $Typed<ModEventLabel>
    | $Typed<ModEventAcknowledge>
    | $Typed<ModEventEscalate>
    | $Typed<ModEventMute>
    | $Typed<ModEventUnmute>
    | $Typed<ModEventMuteReporter>
    | $Typed<ModEventUnmuteReporter>
    | $Typed<ModEventEmail>
    | $Typed<ModEventResolveAppeal>
    | $Typed<ModEventDivert>
    | $Typed<ModEventTag>
    | $Typed<AccountEvent>
    | $Typed<IdentityEvent>
    | $Typed<RecordEvent>
    | { $type: string }
  subject:
    | $Typed<RepoView>
    | $Typed<RepoViewNotFound>
    | $Typed<RecordView>
    | $Typed<RecordViewNotFound>
    | { $type: string }
  subjectBlobs: BlobView[]
  createdBy: string
  createdAt: string
}

const hashModEventViewDetail = 'modEventViewDetail'

export function isModEventViewDetail<V>(v: V) {
  return is$typed(v, id, hashModEventViewDetail)
}

export function validateModEventViewDetail<V>(v: V) {
  return validate<ModEventViewDetail & V>(v, id, hashModEventViewDetail)
}

export function isValidModEventViewDetail<V>(v: V) {
  return isValid<ModEventViewDetail>(v, id, hashModEventViewDetail)
}

export interface SubjectStatusView {
  $type?: $Type<'tools.ozone.moderation.defs', 'subjectStatusView'>
  id: number
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  hosting?: $Typed<AccountHosting> | $Typed<RecordHosting> | { $type: string }
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
}

const hashSubjectStatusView = 'subjectStatusView'

export function isSubjectStatusView<V>(v: V) {
  return is$typed(v, id, hashSubjectStatusView)
}

export function validateSubjectStatusView<V>(v: V) {
  return validate<SubjectStatusView & V>(v, id, hashSubjectStatusView)
}

export function isValidSubjectStatusView<V>(v: V) {
  return isValid<SubjectStatusView>(v, id, hashSubjectStatusView)
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
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventTakedown'>
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
  /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
  acknowledgeAccountSubjects?: boolean
}

const hashModEventTakedown = 'modEventTakedown'

export function isModEventTakedown<V>(v: V) {
  return is$typed(v, id, hashModEventTakedown)
}

export function validateModEventTakedown<V>(v: V) {
  return validate<ModEventTakedown & V>(v, id, hashModEventTakedown)
}

export function isValidModEventTakedown<V>(v: V) {
  return isValid<ModEventTakedown>(v, id, hashModEventTakedown)
}

/** Revert take down action on a subject */
export interface ModEventReverseTakedown {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventReverseTakedown'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

const hashModEventReverseTakedown = 'modEventReverseTakedown'

export function isModEventReverseTakedown<V>(v: V) {
  return is$typed(v, id, hashModEventReverseTakedown)
}

export function validateModEventReverseTakedown<V>(v: V) {
  return validate<ModEventReverseTakedown & V>(
    v,
    id,
    hashModEventReverseTakedown,
  )
}

export function isValidModEventReverseTakedown<V>(v: V) {
  return isValid<ModEventReverseTakedown>(v, id, hashModEventReverseTakedown)
}

/** Resolve appeal on a subject */
export interface ModEventResolveAppeal {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventResolveAppeal'>
  /** Describe resolution. */
  comment?: string
}

const hashModEventResolveAppeal = 'modEventResolveAppeal'

export function isModEventResolveAppeal<V>(v: V) {
  return is$typed(v, id, hashModEventResolveAppeal)
}

export function validateModEventResolveAppeal<V>(v: V) {
  return validate<ModEventResolveAppeal & V>(v, id, hashModEventResolveAppeal)
}

export function isValidModEventResolveAppeal<V>(v: V) {
  return isValid<ModEventResolveAppeal>(v, id, hashModEventResolveAppeal)
}

/** Add a comment to a subject */
export interface ModEventComment {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventComment'>
  comment: string
  /** Make the comment persistent on the subject */
  sticky?: boolean
}

const hashModEventComment = 'modEventComment'

export function isModEventComment<V>(v: V) {
  return is$typed(v, id, hashModEventComment)
}

export function validateModEventComment<V>(v: V) {
  return validate<ModEventComment & V>(v, id, hashModEventComment)
}

export function isValidModEventComment<V>(v: V) {
  return isValid<ModEventComment>(v, id, hashModEventComment)
}

/** Report a subject */
export interface ModEventReport {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventReport'>
  comment?: string
  /** Set to true if the reporter was muted from reporting at the time of the event. These reports won't impact the reviewState of the subject. */
  isReporterMuted?: boolean
  reportType: ComAtprotoModerationDefs.ReasonType
}

const hashModEventReport = 'modEventReport'

export function isModEventReport<V>(v: V) {
  return is$typed(v, id, hashModEventReport)
}

export function validateModEventReport<V>(v: V) {
  return validate<ModEventReport & V>(v, id, hashModEventReport)
}

export function isValidModEventReport<V>(v: V) {
  return isValid<ModEventReport>(v, id, hashModEventReport)
}

/** Apply/Negate labels on a subject */
export interface ModEventLabel {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventLabel'>
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
}

const hashModEventLabel = 'modEventLabel'

export function isModEventLabel<V>(v: V) {
  return is$typed(v, id, hashModEventLabel)
}

export function validateModEventLabel<V>(v: V) {
  return validate<ModEventLabel & V>(v, id, hashModEventLabel)
}

export function isValidModEventLabel<V>(v: V) {
  return isValid<ModEventLabel>(v, id, hashModEventLabel)
}

export interface ModEventAcknowledge {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventAcknowledge'>
  comment?: string
  /** If true, all other reports on content authored by this account will be resolved (acknowledged). */
  acknowledgeAccountSubjects?: boolean
}

const hashModEventAcknowledge = 'modEventAcknowledge'

export function isModEventAcknowledge<V>(v: V) {
  return is$typed(v, id, hashModEventAcknowledge)
}

export function validateModEventAcknowledge<V>(v: V) {
  return validate<ModEventAcknowledge & V>(v, id, hashModEventAcknowledge)
}

export function isValidModEventAcknowledge<V>(v: V) {
  return isValid<ModEventAcknowledge>(v, id, hashModEventAcknowledge)
}

export interface ModEventEscalate {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventEscalate'>
  comment?: string
}

const hashModEventEscalate = 'modEventEscalate'

export function isModEventEscalate<V>(v: V) {
  return is$typed(v, id, hashModEventEscalate)
}

export function validateModEventEscalate<V>(v: V) {
  return validate<ModEventEscalate & V>(v, id, hashModEventEscalate)
}

export function isValidModEventEscalate<V>(v: V) {
  return isValid<ModEventEscalate>(v, id, hashModEventEscalate)
}

/** Mute incoming reports on a subject */
export interface ModEventMute {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventMute'>
  comment?: string
  /** Indicates how long the subject should remain muted. */
  durationInHours: number
}

const hashModEventMute = 'modEventMute'

export function isModEventMute<V>(v: V) {
  return is$typed(v, id, hashModEventMute)
}

export function validateModEventMute<V>(v: V) {
  return validate<ModEventMute & V>(v, id, hashModEventMute)
}

export function isValidModEventMute<V>(v: V) {
  return isValid<ModEventMute>(v, id, hashModEventMute)
}

/** Unmute action on a subject */
export interface ModEventUnmute {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventUnmute'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

const hashModEventUnmute = 'modEventUnmute'

export function isModEventUnmute<V>(v: V) {
  return is$typed(v, id, hashModEventUnmute)
}

export function validateModEventUnmute<V>(v: V) {
  return validate<ModEventUnmute & V>(v, id, hashModEventUnmute)
}

export function isValidModEventUnmute<V>(v: V) {
  return isValid<ModEventUnmute>(v, id, hashModEventUnmute)
}

/** Mute incoming reports from an account */
export interface ModEventMuteReporter {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventMuteReporter'>
  comment?: string
  /** Indicates how long the account should remain muted. Falsy value here means a permanent mute. */
  durationInHours?: number
}

const hashModEventMuteReporter = 'modEventMuteReporter'

export function isModEventMuteReporter<V>(v: V) {
  return is$typed(v, id, hashModEventMuteReporter)
}

export function validateModEventMuteReporter<V>(v: V) {
  return validate<ModEventMuteReporter & V>(v, id, hashModEventMuteReporter)
}

export function isValidModEventMuteReporter<V>(v: V) {
  return isValid<ModEventMuteReporter>(v, id, hashModEventMuteReporter)
}

/** Unmute incoming reports from an account */
export interface ModEventUnmuteReporter {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventUnmuteReporter'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

const hashModEventUnmuteReporter = 'modEventUnmuteReporter'

export function isModEventUnmuteReporter<V>(v: V) {
  return is$typed(v, id, hashModEventUnmuteReporter)
}

export function validateModEventUnmuteReporter<V>(v: V) {
  return validate<ModEventUnmuteReporter & V>(v, id, hashModEventUnmuteReporter)
}

export function isValidModEventUnmuteReporter<V>(v: V) {
  return isValid<ModEventUnmuteReporter>(v, id, hashModEventUnmuteReporter)
}

/** Keep a log of outgoing email to a user */
export interface ModEventEmail {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventEmail'>
  /** The subject line of the email sent to the user. */
  subjectLine: string
  /** The content of the email sent to the user. */
  content?: string
  /** Additional comment about the outgoing comm. */
  comment?: string
}

const hashModEventEmail = 'modEventEmail'

export function isModEventEmail<V>(v: V) {
  return is$typed(v, id, hashModEventEmail)
}

export function validateModEventEmail<V>(v: V) {
  return validate<ModEventEmail & V>(v, id, hashModEventEmail)
}

export function isValidModEventEmail<V>(v: V) {
  return isValid<ModEventEmail>(v, id, hashModEventEmail)
}

/** Divert a record's blobs to a 3rd party service for further scanning/tagging */
export interface ModEventDivert {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventDivert'>
  comment?: string
}

const hashModEventDivert = 'modEventDivert'

export function isModEventDivert<V>(v: V) {
  return is$typed(v, id, hashModEventDivert)
}

export function validateModEventDivert<V>(v: V) {
  return validate<ModEventDivert & V>(v, id, hashModEventDivert)
}

export function isValidModEventDivert<V>(v: V) {
  return isValid<ModEventDivert>(v, id, hashModEventDivert)
}

/** Add/Remove a tag on a subject */
export interface ModEventTag {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventTag'>
  /** Tags to be added to the subject. If already exists, won't be duplicated. */
  add: string[]
  /** Tags to be removed to the subject. Ignores a tag If it doesn't exist, won't be duplicated. */
  remove: string[]
  /** Additional comment about added/removed tags. */
  comment?: string
}

const hashModEventTag = 'modEventTag'

export function isModEventTag<V>(v: V) {
  return is$typed(v, id, hashModEventTag)
}

export function validateModEventTag<V>(v: V) {
  return validate<ModEventTag & V>(v, id, hashModEventTag)
}

export function isValidModEventTag<V>(v: V) {
  return isValid<ModEventTag>(v, id, hashModEventTag)
}

/** Logs account status related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface AccountEvent {
  $type?: $Type<'tools.ozone.moderation.defs', 'accountEvent'>
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
}

const hashAccountEvent = 'accountEvent'

export function isAccountEvent<V>(v: V) {
  return is$typed(v, id, hashAccountEvent)
}

export function validateAccountEvent<V>(v: V) {
  return validate<AccountEvent & V>(v, id, hashAccountEvent)
}

export function isValidAccountEvent<V>(v: V) {
  return isValid<AccountEvent>(v, id, hashAccountEvent)
}

/** Logs identity related events on a repo subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface IdentityEvent {
  $type?: $Type<'tools.ozone.moderation.defs', 'identityEvent'>
  comment?: string
  handle?: string
  pdsHost?: string
  tombstone?: boolean
  timestamp: string
}

const hashIdentityEvent = 'identityEvent'

export function isIdentityEvent<V>(v: V) {
  return is$typed(v, id, hashIdentityEvent)
}

export function validateIdentityEvent<V>(v: V) {
  return validate<IdentityEvent & V>(v, id, hashIdentityEvent)
}

export function isValidIdentityEvent<V>(v: V) {
  return isValid<IdentityEvent>(v, id, hashIdentityEvent)
}

/** Logs lifecycle event on a record subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface RecordEvent {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordEvent'>
  comment?: string
  op: 'create' | 'update' | 'delete' | (string & {})
  cid?: string
  timestamp: string
}

const hashRecordEvent = 'recordEvent'

export function isRecordEvent<V>(v: V) {
  return is$typed(v, id, hashRecordEvent)
}

export function validateRecordEvent<V>(v: V) {
  return validate<RecordEvent & V>(v, id, hashRecordEvent)
}

export function isValidRecordEvent<V>(v: V) {
  return isValid<RecordEvent>(v, id, hashRecordEvent)
}

export interface RepoView {
  $type?: $Type<'tools.ozone.moderation.defs', 'repoView'>
  did: string
  handle: string
  email?: string
  relatedRecords: { [_ in string]: unknown }[]
  indexedAt: string
  moderation: Moderation
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invitesDisabled?: boolean
  inviteNote?: string
  deactivatedAt?: string
  threatSignatures?: ComAtprotoAdminDefs.ThreatSignature[]
}

const hashRepoView = 'repoView'

export function isRepoView<V>(v: V) {
  return is$typed(v, id, hashRepoView)
}

export function validateRepoView<V>(v: V) {
  return validate<RepoView & V>(v, id, hashRepoView)
}

export function isValidRepoView<V>(v: V) {
  return isValid<RepoView>(v, id, hashRepoView)
}

export interface RepoViewDetail {
  $type?: $Type<'tools.ozone.moderation.defs', 'repoViewDetail'>
  did: string
  handle: string
  email?: string
  relatedRecords: { [_ in string]: unknown }[]
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
}

const hashRepoViewDetail = 'repoViewDetail'

export function isRepoViewDetail<V>(v: V) {
  return is$typed(v, id, hashRepoViewDetail)
}

export function validateRepoViewDetail<V>(v: V) {
  return validate<RepoViewDetail & V>(v, id, hashRepoViewDetail)
}

export function isValidRepoViewDetail<V>(v: V) {
  return isValid<RepoViewDetail>(v, id, hashRepoViewDetail)
}

export interface RepoViewNotFound {
  $type?: $Type<'tools.ozone.moderation.defs', 'repoViewNotFound'>
  did: string
}

const hashRepoViewNotFound = 'repoViewNotFound'

export function isRepoViewNotFound<V>(v: V) {
  return is$typed(v, id, hashRepoViewNotFound)
}

export function validateRepoViewNotFound<V>(v: V) {
  return validate<RepoViewNotFound & V>(v, id, hashRepoViewNotFound)
}

export function isValidRepoViewNotFound<V>(v: V) {
  return isValid<RepoViewNotFound>(v, id, hashRepoViewNotFound)
}

export interface RecordView {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordView'>
  uri: string
  cid: string
  value: { [_ in string]: unknown }
  blobCids: string[]
  indexedAt: string
  moderation: Moderation
  repo: RepoView
}

const hashRecordView = 'recordView'

export function isRecordView<V>(v: V) {
  return is$typed(v, id, hashRecordView)
}

export function validateRecordView<V>(v: V) {
  return validate<RecordView & V>(v, id, hashRecordView)
}

export function isValidRecordView<V>(v: V) {
  return isValid<RecordView>(v, id, hashRecordView)
}

export interface RecordViewDetail {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordViewDetail'>
  uri: string
  cid: string
  value: { [_ in string]: unknown }
  blobs: BlobView[]
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
  moderation: ModerationDetail
  repo: RepoView
}

const hashRecordViewDetail = 'recordViewDetail'

export function isRecordViewDetail<V>(v: V) {
  return is$typed(v, id, hashRecordViewDetail)
}

export function validateRecordViewDetail<V>(v: V) {
  return validate<RecordViewDetail & V>(v, id, hashRecordViewDetail)
}

export function isValidRecordViewDetail<V>(v: V) {
  return isValid<RecordViewDetail>(v, id, hashRecordViewDetail)
}

export interface RecordViewNotFound {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordViewNotFound'>
  uri: string
}

const hashRecordViewNotFound = 'recordViewNotFound'

export function isRecordViewNotFound<V>(v: V) {
  return is$typed(v, id, hashRecordViewNotFound)
}

export function validateRecordViewNotFound<V>(v: V) {
  return validate<RecordViewNotFound & V>(v, id, hashRecordViewNotFound)
}

export function isValidRecordViewNotFound<V>(v: V) {
  return isValid<RecordViewNotFound>(v, id, hashRecordViewNotFound)
}

export interface Moderation {
  $type?: $Type<'tools.ozone.moderation.defs', 'moderation'>
  subjectStatus?: SubjectStatusView
}

const hashModeration = 'moderation'

export function isModeration<V>(v: V) {
  return is$typed(v, id, hashModeration)
}

export function validateModeration<V>(v: V) {
  return validate<Moderation & V>(v, id, hashModeration)
}

export function isValidModeration<V>(v: V) {
  return isValid<Moderation>(v, id, hashModeration)
}

export interface ModerationDetail {
  $type?: $Type<'tools.ozone.moderation.defs', 'moderationDetail'>
  subjectStatus?: SubjectStatusView
}

const hashModerationDetail = 'moderationDetail'

export function isModerationDetail<V>(v: V) {
  return is$typed(v, id, hashModerationDetail)
}

export function validateModerationDetail<V>(v: V) {
  return validate<ModerationDetail & V>(v, id, hashModerationDetail)
}

export function isValidModerationDetail<V>(v: V) {
  return isValid<ModerationDetail>(v, id, hashModerationDetail)
}

export interface BlobView {
  $type?: $Type<'tools.ozone.moderation.defs', 'blobView'>
  cid: string
  mimeType: string
  size: number
  createdAt: string
  details?: $Typed<ImageDetails> | $Typed<VideoDetails> | { $type: string }
  moderation?: Moderation
}

const hashBlobView = 'blobView'

export function isBlobView<V>(v: V) {
  return is$typed(v, id, hashBlobView)
}

export function validateBlobView<V>(v: V) {
  return validate<BlobView & V>(v, id, hashBlobView)
}

export function isValidBlobView<V>(v: V) {
  return isValid<BlobView>(v, id, hashBlobView)
}

export interface ImageDetails {
  $type?: $Type<'tools.ozone.moderation.defs', 'imageDetails'>
  width: number
  height: number
}

const hashImageDetails = 'imageDetails'

export function isImageDetails<V>(v: V) {
  return is$typed(v, id, hashImageDetails)
}

export function validateImageDetails<V>(v: V) {
  return validate<ImageDetails & V>(v, id, hashImageDetails)
}

export function isValidImageDetails<V>(v: V) {
  return isValid<ImageDetails>(v, id, hashImageDetails)
}

export interface VideoDetails {
  $type?: $Type<'tools.ozone.moderation.defs', 'videoDetails'>
  width: number
  height: number
  length: number
}

const hashVideoDetails = 'videoDetails'

export function isVideoDetails<V>(v: V) {
  return is$typed(v, id, hashVideoDetails)
}

export function validateVideoDetails<V>(v: V) {
  return validate<VideoDetails & V>(v, id, hashVideoDetails)
}

export function isValidVideoDetails<V>(v: V) {
  return isValid<VideoDetails>(v, id, hashVideoDetails)
}

export interface AccountHosting {
  $type?: $Type<'tools.ozone.moderation.defs', 'accountHosting'>
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
}

const hashAccountHosting = 'accountHosting'

export function isAccountHosting<V>(v: V) {
  return is$typed(v, id, hashAccountHosting)
}

export function validateAccountHosting<V>(v: V) {
  return validate<AccountHosting & V>(v, id, hashAccountHosting)
}

export function isValidAccountHosting<V>(v: V) {
  return isValid<AccountHosting>(v, id, hashAccountHosting)
}

export interface RecordHosting {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordHosting'>
  status: 'deleted' | 'unknown' | (string & {})
  updatedAt?: string
  createdAt?: string
  deletedAt?: string
}

const hashRecordHosting = 'recordHosting'

export function isRecordHosting<V>(v: V) {
  return is$typed(v, id, hashRecordHosting)
}

export function validateRecordHosting<V>(v: V) {
  return validate<RecordHosting & V>(v, id, hashRecordHosting)
}

export function isValidRecordHosting<V>(v: V) {
  return isValid<RecordHosting>(v, id, hashRecordHosting)
}
