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

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.history.defs'

export interface ReportedSubjectView {
  $type?: 'tools.ozone.history.defs#reportedSubjectView'
  subject: string
  comment?: string
  createdAt: string
  status:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
  actions?: EventView[]
}

const hashReportedSubjectView = 'reportedSubjectView'

export function isReportedSubjectView<V>(v: V) {
  return is$typed(v, id, hashReportedSubjectView)
}

export function validateReportedSubjectView<V>(v: V) {
  return validate<ReportedSubjectView & V>(v, id, hashReportedSubjectView)
}

export interface EventView {
  $type?: 'tools.ozone.history.defs#eventView'
  subject: string
  createdAt: string
  isAutomated: boolean
  event:
    | $Typed<EventTakedown>
    | $Typed<EventReverseTakedown>
    | $Typed<EventLabel>
    | $Typed<EventEmail>
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

/** Takedown reversed on the subject */
export interface EventReverseTakedown {
  $type?: 'tools.ozone.history.defs#eventReverseTakedown'
  comment?: string
}

const hashEventReverseTakedown = 'eventReverseTakedown'

export function isEventReverseTakedown<V>(v: V) {
  return is$typed(v, id, hashEventReverseTakedown)
}

export function validateEventReverseTakedown<V>(v: V) {
  return validate<EventReverseTakedown & V>(v, id, hashEventReverseTakedown)
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
