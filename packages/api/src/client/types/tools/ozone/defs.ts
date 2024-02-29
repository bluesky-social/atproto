/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from '../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef'
import * as ComAtprotoModerationDefs from '../../com/atproto/moderation/defs'

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
    | ModEventResolveAppeal
    | ModEventDivert
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoRef
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
    v.$type === 'tools.ozone.defs#modEventView'
  )
}

export function validateModEventView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventView', v)
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
    | ModEventEmail
    | ModEventResolveAppeal
    | ModEventDivert
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoView
    | ComAtprotoAdminDefs.RepoViewNotFound
    | ComAtprotoAdminDefs.RecordView
    | ComAtprotoAdminDefs.RecordViewNotFound
    | { $type: string; [k: string]: unknown }
  subjectBlobs: ComAtprotoAdminDefs.BlobView[]
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export function isModEventViewDetail(v: unknown): v is ModEventViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventViewDetail'
  )
}

export function validateModEventViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventViewDetail', v)
}

export interface SubjectStatusView {
  id: number
  subject:
    | ComAtprotoAdminDefs.RepoRef
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
  /** Timestamp referencing when the author of the subject appealed a moderation action */
  lastAppealedAt?: string
  takendown?: boolean
  /** True indicates that the a previously taken moderator action was appealed against, by the author of the content. False indicates last appeal was resolved by moderators. */
  appealed?: boolean
  suspendUntil?: string
  tags?: string[]
  [k: string]: unknown
}

export function isSubjectStatusView(v: unknown): v is SubjectStatusView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#subjectStatusView'
  )
}

export function validateSubjectStatusView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#subjectStatusView', v)
}

export type SubjectReviewState =
  | 'lex:tools.ozone.defs#reviewOpen'
  | 'lex:tools.ozone.defs#reviewEscalated'
  | 'lex:tools.ozone.defs#reviewClosed'
  | 'lex:tools.ozone.defs#reviewNone'
  | (string & {})

/** Moderator review status of a subject: Open. Indicates that the subject needs to be reviewed by a moderator */
export const REVIEWOPEN = 'tools.ozone.defs#reviewOpen'
/** Moderator review status of a subject: Escalated. Indicates that the subject was escalated for review by a moderator */
export const REVIEWESCALATED = 'tools.ozone.defs#reviewEscalated'
/** Moderator review status of a subject: Closed. Indicates that the subject was already reviewed and resolved by a moderator */
export const REVIEWCLOSED = 'tools.ozone.defs#reviewClosed'
/** Moderator review status of a subject: Unnecessary. Indicates that the subject does not need a review at the moment but there is probably some moderation related metadata available for it */
export const REVIEWNONE = 'tools.ozone.defs#reviewNone'

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
    v.$type === 'tools.ozone.defs#modEventTakedown'
  )
}

export function validateModEventTakedown(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventTakedown', v)
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
    v.$type === 'tools.ozone.defs#modEventReverseTakedown'
  )
}

export function validateModEventReverseTakedown(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventReverseTakedown', v)
}

/** Resolve appeal on a subject */
export interface ModEventResolveAppeal {
  /** Describe resolution. */
  comment?: string
  [k: string]: unknown
}

export function isModEventResolveAppeal(
  v: unknown,
): v is ModEventResolveAppeal {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventResolveAppeal'
  )
}

export function validateModEventResolveAppeal(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventResolveAppeal', v)
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
    v.$type === 'tools.ozone.defs#modEventComment'
  )
}

export function validateModEventComment(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventComment', v)
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
    v.$type === 'tools.ozone.defs#modEventReport'
  )
}

export function validateModEventReport(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventReport', v)
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
    v.$type === 'tools.ozone.defs#modEventLabel'
  )
}

export function validateModEventLabel(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventLabel', v)
}

export interface ModEventAcknowledge {
  comment?: string
  [k: string]: unknown
}

export function isModEventAcknowledge(v: unknown): v is ModEventAcknowledge {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventAcknowledge'
  )
}

export function validateModEventAcknowledge(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventAcknowledge', v)
}

export interface ModEventEscalate {
  comment?: string
  [k: string]: unknown
}

export function isModEventEscalate(v: unknown): v is ModEventEscalate {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventEscalate'
  )
}

export function validateModEventEscalate(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventEscalate', v)
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
    v.$type === 'tools.ozone.defs#modEventMute'
  )
}

export function validateModEventMute(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventMute', v)
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
    v.$type === 'tools.ozone.defs#modEventUnmute'
  )
}

export function validateModEventUnmute(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventUnmute', v)
}

/** Keep a log of outgoing email to a user */
export interface ModEventEmail {
  /** The subject line of the email sent to the user. */
  subjectLine: string
  /** Additional comment about the outgoing comm. */
  comment?: string
  [k: string]: unknown
}

export function isModEventEmail(v: unknown): v is ModEventEmail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventEmail'
  )
}

export function validateModEventEmail(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventEmail', v)
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

export function isModEventTag(v: unknown): v is ModEventTag {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventTag'
  )
}

export function validateModEventTag(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventTag', v)
}

/** Divert a record's blobs to a 3rd party service for further scanning/tagging */
export interface ModEventDivert {
  comment?: string
  [k: string]: unknown
}

export function isModEventDivert(v: unknown): v is ModEventDivert {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#modEventDivert'
  )
}

export function validateModEventDivert(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.defs#modEventDivert', v)
}

export interface CommunicationTemplateView {
  id: string
  /** Name of the template. */
  name: string
  /** Content of the template, can contain markdown and variable placeholders. */
  subject?: string
  /** Subject of the message, used in emails. */
  contentMarkdown: string
  disabled: boolean
  /** DID of the user who last updated the template. */
  lastUpdatedBy: string
  createdAt: string
  updatedAt: string
  [k: string]: unknown
}

export function isCommunicationTemplateView(
  v: unknown,
): v is CommunicationTemplateView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.defs#communicationTemplateView'
  )
}

export function validateCommunicationTemplateView(
  v: unknown,
): ValidationResult {
  return lexicons.validate('tools.ozone.defs#communicationTemplateView', v)
}
