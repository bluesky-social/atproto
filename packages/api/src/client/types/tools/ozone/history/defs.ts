/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'

export interface SubjectBasicView {
  subject: string
  status: string
  modAction:
    | 'lex:tools.ozone.history.defs#modActionPending'
    | 'lex:tools.ozone.history.defs#modActionLabel'
    | 'lex:tools.ozone.history.defs#modActionResolve'
    | 'lex:tools.ozone.history.defs#modActionSuspend'
    | 'lex:tools.ozone.history.defs#modActionTakedown'
    | (string & {})
  subjectProfile?: AppBskyActorDefs.ProfileViewBasic
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isSubjectBasicView(v: unknown): v is SubjectBasicView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#subjectBasicView'
  )
}

export function validateSubjectBasicView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#subjectBasicView', v)
}

export interface EventView {
  subject: string
  createdAt: string
  isAutomated: boolean
  event:
    | EventTakedown
    | EventLabel
    | EventReport
    | EventEmail
    | EventResolve
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isEventView(v: unknown): v is EventView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventView'
  )
}

export function validateEventView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventView', v)
}

/** Permanently or temporarily taken down */
export interface EventTakedown {
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
  [k: string]: unknown
}

export function isEventTakedown(v: unknown): v is EventTakedown {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventTakedown'
  )
}

export function validateEventTakedown(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventTakedown', v)
}

/** Label(s) applied/negated */
export interface EventLabel {
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
  [k: string]: unknown
}

export function isEventLabel(v: unknown): v is EventLabel {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventLabel'
  )
}

export function validateEventLabel(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventLabel', v)
}

/** Subject reported */
export interface EventReport {
  comment?: string
  reportType: ComAtprotoModerationDefs.ReasonType
  [k: string]: unknown
}

export function isEventReport(v: unknown): v is EventReport {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventReport'
  )
}

export function validateEventReport(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventReport', v)
}

/** Moderation email sent to the author of the subject */
export interface EventEmail {
  /** The subject line of the email sent to the user. */
  subjectLine: string
  /** The content of the email sent to the user. */
  content?: string
  /** Additional comment about the outgoing comm. */
  comment?: string
  [k: string]: unknown
}

export function isEventEmail(v: unknown): v is EventEmail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventEmail'
  )
}

export function validateEventEmail(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventEmail', v)
}

/** Reports on the subject acknowledged by a moderator */
export interface EventResolve {
  /** Describe the resolution or acknowledgment. */
  comment?: string
  [k: string]: unknown
}

export function isEventResolve(v: unknown): v is EventResolve {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.defs#eventResolve'
  )
}

export function validateEventResolve(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.defs#eventResolve', v)
}

/** Awaiting moderator review on the reported subject */
export const MODACTIONPENDING = 'tools.ozone.history.defs#modActionPending'
/** Moderator acknowledged report and marked as resolved the subject without action */
export const MODACTIONRESOLVE = 'tools.ozone.history.defs#modActionResolve'
/** Moderator added or removed label(s) on the reported subject */
export const MODACTIONLABEL = 'tools.ozone.history.defs#modActionLabel'
/** Moderator permanently took down the reported subject */
export const MODACTIONTAKEDOWN = 'tools.ozone.history.defs#modActionTakedown'
/** Moderator temporarily took down the reported subject */
export const MODACTIONSUSPEND = 'tools.ozone.history.defs#modActionSuspend'
