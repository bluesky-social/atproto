/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'

export interface SubjectBasicView {
  subject: string
  status: string
  reviewState: string
  subjectProfile: AppBskyActorDefs.ProfileViewBasic
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
  uri: string
  createdAt: string
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

/** Take down a subject permanently or temporarily */
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

/** Apply/Negate labels on a subject */
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

/** Report a subject */
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

/** Keep a log of outgoing email to a user */
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

/** Resolve or acknowledge an event on a subject */
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
