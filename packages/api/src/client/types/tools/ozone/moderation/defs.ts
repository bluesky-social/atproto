/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as ChatBskyConvoDefs from '../../../chat/bsky/convo/defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'
import * as ComAtprotoServerDefs from '../../../com/atproto/server/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'tools.ozone.moderation.defs'

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

export function isModEventView<V>(v: V) {
  return is$typed(v, id, 'modEventView')
}

export function validateModEventView(v: unknown) {
  return lexicons.validate(
    `${id}#modEventView`,
    v,
  ) as ValidationResult<ModEventView>
}

export function isValidModEventView<V>(v: V): v is V & $Typed<ModEventView> {
  return isModEventView(v) && validateModEventView(v).success
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

export function isModEventViewDetail<V>(v: V) {
  return is$typed(v, id, 'modEventViewDetail')
}

export function validateModEventViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#modEventViewDetail`,
    v,
  ) as ValidationResult<ModEventViewDetail>
}

export function isValidModEventViewDetail<V>(
  v: V,
): v is V & $Typed<ModEventViewDetail> {
  return isModEventViewDetail(v) && validateModEventViewDetail(v).success
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

export function isSubjectStatusView<V>(v: V) {
  return is$typed(v, id, 'subjectStatusView')
}

export function validateSubjectStatusView(v: unknown) {
  return lexicons.validate(
    `${id}#subjectStatusView`,
    v,
  ) as ValidationResult<SubjectStatusView>
}

export function isValidSubjectStatusView<V>(
  v: V,
): v is V & $Typed<SubjectStatusView> {
  return isSubjectStatusView(v) && validateSubjectStatusView(v).success
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

export function isModEventTakedown<V>(v: V) {
  return is$typed(v, id, 'modEventTakedown')
}

export function validateModEventTakedown(v: unknown) {
  return lexicons.validate(
    `${id}#modEventTakedown`,
    v,
  ) as ValidationResult<ModEventTakedown>
}

export function isValidModEventTakedown<V>(
  v: V,
): v is V & $Typed<ModEventTakedown> {
  return isModEventTakedown(v) && validateModEventTakedown(v).success
}

/** Revert take down action on a subject */
export interface ModEventReverseTakedown {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventReverseTakedown'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

export function isModEventReverseTakedown<V>(v: V) {
  return is$typed(v, id, 'modEventReverseTakedown')
}

export function validateModEventReverseTakedown(v: unknown) {
  return lexicons.validate(
    `${id}#modEventReverseTakedown`,
    v,
  ) as ValidationResult<ModEventReverseTakedown>
}

export function isValidModEventReverseTakedown<V>(
  v: V,
): v is V & $Typed<ModEventReverseTakedown> {
  return (
    isModEventReverseTakedown(v) && validateModEventReverseTakedown(v).success
  )
}

/** Resolve appeal on a subject */
export interface ModEventResolveAppeal {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventResolveAppeal'>
  /** Describe resolution. */
  comment?: string
}

export function isModEventResolveAppeal<V>(v: V) {
  return is$typed(v, id, 'modEventResolveAppeal')
}

export function validateModEventResolveAppeal(v: unknown) {
  return lexicons.validate(
    `${id}#modEventResolveAppeal`,
    v,
  ) as ValidationResult<ModEventResolveAppeal>
}

export function isValidModEventResolveAppeal<V>(
  v: V,
): v is V & $Typed<ModEventResolveAppeal> {
  return isModEventResolveAppeal(v) && validateModEventResolveAppeal(v).success
}

/** Add a comment to a subject */
export interface ModEventComment {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventComment'>
  comment: string
  /** Make the comment persistent on the subject */
  sticky?: boolean
}

export function isModEventComment<V>(v: V) {
  return is$typed(v, id, 'modEventComment')
}

export function validateModEventComment(v: unknown) {
  return lexicons.validate(
    `${id}#modEventComment`,
    v,
  ) as ValidationResult<ModEventComment>
}

export function isValidModEventComment<V>(
  v: V,
): v is V & $Typed<ModEventComment> {
  return isModEventComment(v) && validateModEventComment(v).success
}

/** Report a subject */
export interface ModEventReport {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventReport'>
  comment?: string
  /** Set to true if the reporter was muted from reporting at the time of the event. These reports won't impact the reviewState of the subject. */
  isReporterMuted?: boolean
  reportType: ComAtprotoModerationDefs.ReasonType
}

export function isModEventReport<V>(v: V) {
  return is$typed(v, id, 'modEventReport')
}

export function validateModEventReport(v: unknown) {
  return lexicons.validate(
    `${id}#modEventReport`,
    v,
  ) as ValidationResult<ModEventReport>
}

export function isValidModEventReport<V>(
  v: V,
): v is V & $Typed<ModEventReport> {
  return isModEventReport(v) && validateModEventReport(v).success
}

/** Apply/Negate labels on a subject */
export interface ModEventLabel {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventLabel'>
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
}

export function isModEventLabel<V>(v: V) {
  return is$typed(v, id, 'modEventLabel')
}

export function validateModEventLabel(v: unknown) {
  return lexicons.validate(
    `${id}#modEventLabel`,
    v,
  ) as ValidationResult<ModEventLabel>
}

export function isValidModEventLabel<V>(v: V): v is V & $Typed<ModEventLabel> {
  return isModEventLabel(v) && validateModEventLabel(v).success
}

export interface ModEventAcknowledge {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventAcknowledge'>
  comment?: string
}

export function isModEventAcknowledge<V>(v: V) {
  return is$typed(v, id, 'modEventAcknowledge')
}

export function validateModEventAcknowledge(v: unknown) {
  return lexicons.validate(
    `${id}#modEventAcknowledge`,
    v,
  ) as ValidationResult<ModEventAcknowledge>
}

export function isValidModEventAcknowledge<V>(
  v: V,
): v is V & $Typed<ModEventAcknowledge> {
  return isModEventAcknowledge(v) && validateModEventAcknowledge(v).success
}

export interface ModEventEscalate {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventEscalate'>
  comment?: string
}

export function isModEventEscalate<V>(v: V) {
  return is$typed(v, id, 'modEventEscalate')
}

export function validateModEventEscalate(v: unknown) {
  return lexicons.validate(
    `${id}#modEventEscalate`,
    v,
  ) as ValidationResult<ModEventEscalate>
}

export function isValidModEventEscalate<V>(
  v: V,
): v is V & $Typed<ModEventEscalate> {
  return isModEventEscalate(v) && validateModEventEscalate(v).success
}

/** Mute incoming reports on a subject */
export interface ModEventMute {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventMute'>
  comment?: string
  /** Indicates how long the subject should remain muted. */
  durationInHours: number
}

export function isModEventMute<V>(v: V) {
  return is$typed(v, id, 'modEventMute')
}

export function validateModEventMute(v: unknown) {
  return lexicons.validate(
    `${id}#modEventMute`,
    v,
  ) as ValidationResult<ModEventMute>
}

export function isValidModEventMute<V>(v: V): v is V & $Typed<ModEventMute> {
  return isModEventMute(v) && validateModEventMute(v).success
}

/** Unmute action on a subject */
export interface ModEventUnmute {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventUnmute'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

export function isModEventUnmute<V>(v: V) {
  return is$typed(v, id, 'modEventUnmute')
}

export function validateModEventUnmute(v: unknown) {
  return lexicons.validate(
    `${id}#modEventUnmute`,
    v,
  ) as ValidationResult<ModEventUnmute>
}

export function isValidModEventUnmute<V>(
  v: V,
): v is V & $Typed<ModEventUnmute> {
  return isModEventUnmute(v) && validateModEventUnmute(v).success
}

/** Mute incoming reports from an account */
export interface ModEventMuteReporter {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventMuteReporter'>
  comment?: string
  /** Indicates how long the account should remain muted. Falsy value here means a permanent mute. */
  durationInHours?: number
}

export function isModEventMuteReporter<V>(v: V) {
  return is$typed(v, id, 'modEventMuteReporter')
}

export function validateModEventMuteReporter(v: unknown) {
  return lexicons.validate(
    `${id}#modEventMuteReporter`,
    v,
  ) as ValidationResult<ModEventMuteReporter>
}

export function isValidModEventMuteReporter<V>(
  v: V,
): v is V & $Typed<ModEventMuteReporter> {
  return isModEventMuteReporter(v) && validateModEventMuteReporter(v).success
}

/** Unmute incoming reports from an account */
export interface ModEventUnmuteReporter {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventUnmuteReporter'>
  /** Describe reasoning behind the reversal. */
  comment?: string
}

export function isModEventUnmuteReporter<V>(v: V) {
  return is$typed(v, id, 'modEventUnmuteReporter')
}

export function validateModEventUnmuteReporter(v: unknown) {
  return lexicons.validate(
    `${id}#modEventUnmuteReporter`,
    v,
  ) as ValidationResult<ModEventUnmuteReporter>
}

export function isValidModEventUnmuteReporter<V>(
  v: V,
): v is V & $Typed<ModEventUnmuteReporter> {
  return (
    isModEventUnmuteReporter(v) && validateModEventUnmuteReporter(v).success
  )
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

export function isModEventEmail<V>(v: V) {
  return is$typed(v, id, 'modEventEmail')
}

export function validateModEventEmail(v: unknown) {
  return lexicons.validate(
    `${id}#modEventEmail`,
    v,
  ) as ValidationResult<ModEventEmail>
}

export function isValidModEventEmail<V>(v: V): v is V & $Typed<ModEventEmail> {
  return isModEventEmail(v) && validateModEventEmail(v).success
}

/** Divert a record's blobs to a 3rd party service for further scanning/tagging */
export interface ModEventDivert {
  $type?: $Type<'tools.ozone.moderation.defs', 'modEventDivert'>
  comment?: string
}

export function isModEventDivert<V>(v: V) {
  return is$typed(v, id, 'modEventDivert')
}

export function validateModEventDivert(v: unknown) {
  return lexicons.validate(
    `${id}#modEventDivert`,
    v,
  ) as ValidationResult<ModEventDivert>
}

export function isValidModEventDivert<V>(
  v: V,
): v is V & $Typed<ModEventDivert> {
  return isModEventDivert(v) && validateModEventDivert(v).success
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

export function isModEventTag<V>(v: V) {
  return is$typed(v, id, 'modEventTag')
}

export function validateModEventTag(v: unknown) {
  return lexicons.validate(
    `${id}#modEventTag`,
    v,
  ) as ValidationResult<ModEventTag>
}

export function isValidModEventTag<V>(v: V): v is V & $Typed<ModEventTag> {
  return isModEventTag(v) && validateModEventTag(v).success
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

export function isAccountEvent<V>(v: V) {
  return is$typed(v, id, 'accountEvent')
}

export function validateAccountEvent(v: unknown) {
  return lexicons.validate(
    `${id}#accountEvent`,
    v,
  ) as ValidationResult<AccountEvent>
}

export function isValidAccountEvent<V>(v: V): v is V & $Typed<AccountEvent> {
  return isAccountEvent(v) && validateAccountEvent(v).success
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

export function isIdentityEvent<V>(v: V) {
  return is$typed(v, id, 'identityEvent')
}

export function validateIdentityEvent(v: unknown) {
  return lexicons.validate(
    `${id}#identityEvent`,
    v,
  ) as ValidationResult<IdentityEvent>
}

export function isValidIdentityEvent<V>(v: V): v is V & $Typed<IdentityEvent> {
  return isIdentityEvent(v) && validateIdentityEvent(v).success
}

/** Logs lifecycle event on a record subject. Normally captured by automod from the firehose and emitted to ozone for historical tracking. */
export interface RecordEvent {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordEvent'>
  comment?: string
  op: 'create' | 'update' | 'delete' | (string & {})
  cid?: string
  timestamp: string
}

export function isRecordEvent<V>(v: V) {
  return is$typed(v, id, 'recordEvent')
}

export function validateRecordEvent(v: unknown) {
  return lexicons.validate(
    `${id}#recordEvent`,
    v,
  ) as ValidationResult<RecordEvent>
}

export function isValidRecordEvent<V>(v: V): v is V & $Typed<RecordEvent> {
  return isRecordEvent(v) && validateRecordEvent(v).success
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

export function isRepoView<V>(v: V) {
  return is$typed(v, id, 'repoView')
}

export function validateRepoView(v: unknown) {
  return lexicons.validate(`${id}#repoView`, v) as ValidationResult<RepoView>
}

export function isValidRepoView<V>(v: V): v is V & $Typed<RepoView> {
  return isRepoView(v) && validateRepoView(v).success
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

export function isRepoViewDetail<V>(v: V) {
  return is$typed(v, id, 'repoViewDetail')
}

export function validateRepoViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#repoViewDetail`,
    v,
  ) as ValidationResult<RepoViewDetail>
}

export function isValidRepoViewDetail<V>(
  v: V,
): v is V & $Typed<RepoViewDetail> {
  return isRepoViewDetail(v) && validateRepoViewDetail(v).success
}

export interface RepoViewNotFound {
  $type?: $Type<'tools.ozone.moderation.defs', 'repoViewNotFound'>
  did: string
}

export function isRepoViewNotFound<V>(v: V) {
  return is$typed(v, id, 'repoViewNotFound')
}

export function validateRepoViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#repoViewNotFound`,
    v,
  ) as ValidationResult<RepoViewNotFound>
}

export function isValidRepoViewNotFound<V>(
  v: V,
): v is V & $Typed<RepoViewNotFound> {
  return isRepoViewNotFound(v) && validateRepoViewNotFound(v).success
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

export function isRecordView<V>(v: V) {
  return is$typed(v, id, 'recordView')
}

export function validateRecordView(v: unknown) {
  return lexicons.validate(
    `${id}#recordView`,
    v,
  ) as ValidationResult<RecordView>
}

export function isValidRecordView<V>(v: V): v is V & $Typed<RecordView> {
  return isRecordView(v) && validateRecordView(v).success
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

export function isRecordViewDetail<V>(v: V) {
  return is$typed(v, id, 'recordViewDetail')
}

export function validateRecordViewDetail(v: unknown) {
  return lexicons.validate(
    `${id}#recordViewDetail`,
    v,
  ) as ValidationResult<RecordViewDetail>
}

export function isValidRecordViewDetail<V>(
  v: V,
): v is V & $Typed<RecordViewDetail> {
  return isRecordViewDetail(v) && validateRecordViewDetail(v).success
}

export interface RecordViewNotFound {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordViewNotFound'>
  uri: string
}

export function isRecordViewNotFound<V>(v: V) {
  return is$typed(v, id, 'recordViewNotFound')
}

export function validateRecordViewNotFound(v: unknown) {
  return lexicons.validate(
    `${id}#recordViewNotFound`,
    v,
  ) as ValidationResult<RecordViewNotFound>
}

export function isValidRecordViewNotFound<V>(
  v: V,
): v is V & $Typed<RecordViewNotFound> {
  return isRecordViewNotFound(v) && validateRecordViewNotFound(v).success
}

export interface Moderation {
  $type?: $Type<'tools.ozone.moderation.defs', 'moderation'>
  subjectStatus?: SubjectStatusView
}

export function isModeration<V>(v: V) {
  return is$typed(v, id, 'moderation')
}

export function validateModeration(v: unknown) {
  return lexicons.validate(
    `${id}#moderation`,
    v,
  ) as ValidationResult<Moderation>
}

export function isValidModeration<V>(v: V): v is V & $Typed<Moderation> {
  return isModeration(v) && validateModeration(v).success
}

export interface ModerationDetail {
  $type?: $Type<'tools.ozone.moderation.defs', 'moderationDetail'>
  subjectStatus?: SubjectStatusView
}

export function isModerationDetail<V>(v: V) {
  return is$typed(v, id, 'moderationDetail')
}

export function validateModerationDetail(v: unknown) {
  return lexicons.validate(
    `${id}#moderationDetail`,
    v,
  ) as ValidationResult<ModerationDetail>
}

export function isValidModerationDetail<V>(
  v: V,
): v is V & $Typed<ModerationDetail> {
  return isModerationDetail(v) && validateModerationDetail(v).success
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

export function isBlobView<V>(v: V) {
  return is$typed(v, id, 'blobView')
}

export function validateBlobView(v: unknown) {
  return lexicons.validate(`${id}#blobView`, v) as ValidationResult<BlobView>
}

export function isValidBlobView<V>(v: V): v is V & $Typed<BlobView> {
  return isBlobView(v) && validateBlobView(v).success
}

export interface ImageDetails {
  $type?: $Type<'tools.ozone.moderation.defs', 'imageDetails'>
  width: number
  height: number
}

export function isImageDetails<V>(v: V) {
  return is$typed(v, id, 'imageDetails')
}

export function validateImageDetails(v: unknown) {
  return lexicons.validate(
    `${id}#imageDetails`,
    v,
  ) as ValidationResult<ImageDetails>
}

export function isValidImageDetails<V>(v: V): v is V & $Typed<ImageDetails> {
  return isImageDetails(v) && validateImageDetails(v).success
}

export interface VideoDetails {
  $type?: $Type<'tools.ozone.moderation.defs', 'videoDetails'>
  width: number
  height: number
  length: number
}

export function isVideoDetails<V>(v: V) {
  return is$typed(v, id, 'videoDetails')
}

export function validateVideoDetails(v: unknown) {
  return lexicons.validate(
    `${id}#videoDetails`,
    v,
  ) as ValidationResult<VideoDetails>
}

export function isValidVideoDetails<V>(v: V): v is V & $Typed<VideoDetails> {
  return isVideoDetails(v) && validateVideoDetails(v).success
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

export function isAccountHosting<V>(v: V) {
  return is$typed(v, id, 'accountHosting')
}

export function validateAccountHosting(v: unknown) {
  return lexicons.validate(
    `${id}#accountHosting`,
    v,
  ) as ValidationResult<AccountHosting>
}

export function isValidAccountHosting<V>(
  v: V,
): v is V & $Typed<AccountHosting> {
  return isAccountHosting(v) && validateAccountHosting(v).success
}

export interface RecordHosting {
  $type?: $Type<'tools.ozone.moderation.defs', 'recordHosting'>
  status: 'deleted' | 'unknown' | (string & {})
  updatedAt?: string
  createdAt?: string
  deletedAt?: string
}

export function isRecordHosting<V>(v: V) {
  return is$typed(v, id, 'recordHosting')
}

export function validateRecordHosting(v: unknown) {
  return lexicons.validate(
    `${id}#recordHosting`,
    v,
  ) as ValidationResult<RecordHosting>
}

export function isValidRecordHosting<V>(v: V): v is V & $Typed<RecordHosting> {
  return isRecordHosting(v) && validateRecordHosting(v).success
}
