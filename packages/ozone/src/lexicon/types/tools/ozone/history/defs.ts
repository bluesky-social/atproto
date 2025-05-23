/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.history.defs'

export interface SubjectBasicView {
  $type?: 'tools.ozone.history.defs#subjectBasicView'
  subject: string
  status: 'deactivated' | 'active' | 'deleted' | (string & {})
  modAction:
    | 'tools.ozone.history.defs#modActionPending'
    | 'tools.ozone.history.defs#modActionLabel'
    | 'tools.ozone.history.defs#modActionResolve'
    | 'tools.ozone.history.defs#modActionSuspend'
    | 'tools.ozone.history.defs#modActionTakedown'
    | (string & {})
  subjectProfile?: { $type: string }
  labels?: ComAtprotoLabelDefs.Label[]
}

const hashSubjectBasicView = 'subjectBasicView'

export function isSubjectBasicView<V>(v: V) {
  return is$typed(v, id, hashSubjectBasicView)
}

export function validateSubjectBasicView<V>(v: V) {
  return validate<SubjectBasicView & V>(v, id, hashSubjectBasicView)
}

export interface EventView {
  $type?: 'tools.ozone.history.defs#eventView'
  subject: string
  createdAt: string
  isAutomated: boolean
  event:
    | $Typed<EventTakedown>
    | $Typed<EventLabel>
    | $Typed<EventReport>
    | $Typed<EventEmail>
    | $Typed<EventResolve>
    | { $type: string }
}

const hashEventView = 'eventView'

export function isEventView<V>(v: V) {
  return is$typed(v, id, hashEventView)
}

export function validateEventView<V>(v: V) {
  return validate<EventView & V>(v, id, hashEventView)
}

/** Permanently or temporarily taken down */
export interface EventTakedown {
  $type?: 'tools.ozone.history.defs#eventTakedown'
  comment?: string
  /** Indicates how long the takedown should be in effect before automatically expiring. */
  durationInHours?: number
}

const hashEventTakedown = 'eventTakedown'

export function isEventTakedown<V>(v: V) {
  return is$typed(v, id, hashEventTakedown)
}

export function validateEventTakedown<V>(v: V) {
  return validate<EventTakedown & V>(v, id, hashEventTakedown)
}

/** Label(s) applied/negated */
export interface EventLabel {
  $type?: 'tools.ozone.history.defs#eventLabel'
  comment?: string
  createLabelVals: string[]
  negateLabelVals: string[]
}

const hashEventLabel = 'eventLabel'

export function isEventLabel<V>(v: V) {
  return is$typed(v, id, hashEventLabel)
}

export function validateEventLabel<V>(v: V) {
  return validate<EventLabel & V>(v, id, hashEventLabel)
}

/** Subject reported */
export interface EventReport {
  $type?: 'tools.ozone.history.defs#eventReport'
  comment?: string
  reportType: ComAtprotoModerationDefs.ReasonType
}

const hashEventReport = 'eventReport'

export function isEventReport<V>(v: V) {
  return is$typed(v, id, hashEventReport)
}

export function validateEventReport<V>(v: V) {
  return validate<EventReport & V>(v, id, hashEventReport)
}

/** Moderation email sent to the author of the subject */
export interface EventEmail {
  $type?: 'tools.ozone.history.defs#eventEmail'
  /** The subject line of the email sent to the user. */
  subjectLine: string
  /** The content of the email sent to the user. */
  content?: string
  /** Additional comment about the outgoing comm. */
  comment?: string
}

const hashEventEmail = 'eventEmail'

export function isEventEmail<V>(v: V) {
  return is$typed(v, id, hashEventEmail)
}

export function validateEventEmail<V>(v: V) {
  return validate<EventEmail & V>(v, id, hashEventEmail)
}

/** Reports on the subject acknowledged by a moderator */
export interface EventResolve {
  $type?: 'tools.ozone.history.defs#eventResolve'
  /** Describe the resolution or acknowledgment. */
  comment?: string
}

const hashEventResolve = 'eventResolve'

export function isEventResolve<V>(v: V) {
  return is$typed(v, id, hashEventResolve)
}

export function validateEventResolve<V>(v: V) {
  return validate<EventResolve & V>(v, id, hashEventResolve)
}

/** Awaiting moderator review on the reported subject */
export const MODACTIONPENDING = `${id}#modActionPending`
/** Moderator acknowledged report and marked as resolved the subject without action */
export const MODACTIONRESOLVE = `${id}#modActionResolve`
/** Moderator added or removed label(s) on the reported subject */
export const MODACTIONLABEL = `${id}#modActionLabel`
/** Moderator permanently took down the reported subject */
export const MODACTIONTAKEDOWN = `${id}#modActionTakedown`
/** Moderator temporarily took down the reported subject */
export const MODACTIONSUSPEND = `${id}#modActionSuspend`
