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
const id = 'tools.ozone.safelink.defs'

/** An event for URL safety decisions */
export interface Event {
  $type?: 'tools.ozone.safelink.defs#event'
  /** Auto-incrementing row ID */
  id: number
  eventType: EventType
  /** The URL that this rule applies to */
  url: string
  pattern: PatternType
  action: ActionType
  reason: ReasonType
  /** DID of the user who created this rule */
  createdBy: string
  createdAt: string
  /** Optional comment about the decision */
  comment?: string
}

const hashEvent = 'event'

export function isEvent<V>(v: V) {
  return is$typed(v, id, hashEvent)
}

export function validateEvent<V>(v: V) {
  return validate<Event & V>(v, id, hashEvent)
}

export type EventType =
  | 'lex:tools.ozone.safelink.defs#addRule'
  | 'lex:tools.ozone.safelink.defs#updateRule'
  | 'lex:tools.ozone.safelink.defs#removeRule'
  | (string & {})

/** Add a new URL safety rule */
export const ADDRULE = `${id}#addRule`
/** Update an existing URL safety rule */
export const UPDATERULE = `${id}#updateRule`
/** Remove an existing URL safety rule */
export const REMOVERULE = `${id}#removeRule`

export type PatternType =
  | 'lex:tools.ozone.safelink.defs#domain'
  | 'lex:tools.ozone.safelink.defs#url'
  | (string & {})

/** Pattern type: Apply rule to entire domain */
export const DOMAIN = `${id}#domain`
/** Pattern type: Apply rule to specific URL */
export const URL = `${id}#url`

export type ActionType =
  | 'lex:tools.ozone.safelink.defs#block'
  | 'lex:tools.ozone.safelink.defs#warn'
  | 'lex:tools.ozone.safelink.defs#whitelist'
  | (string & {})

/** Action type: Block access to URL/domain */
export const BLOCK = `${id}#block`
/** Action type: Show warning interstitial */
export const WARN = `${id}#warn`
/** Action type: Explicitly allow URL/domain */
export const WHITELIST = `${id}#whitelist`

export type ReasonType =
  | 'lex:tools.ozone.safelink.defs#csam'
  | 'lex:tools.ozone.safelink.defs#spam'
  | 'lex:tools.ozone.safelink.defs#phishing'
  | 'lex:tools.ozone.safelink.defs#none'
  | (string & {})

/** Reason type: Child Sexual Abuse Material */
export const CSAM = `${id}#csam`
/** Reason type: Spam content */
export const SPAM = `${id}#spam`
/** Reason type: Phishing attempt */
export const PHISHING = `${id}#phishing`
/** Reason type: No specific reason */
export const NONE = `${id}#none`

/** Input for creating a URL safety rule */
export interface UrlRule {
  $type?: 'tools.ozone.safelink.defs#urlRule'
  /** The URL or domain to apply the rule to */
  url: string
  pattern: PatternType
  action: ActionType
  reason: ReasonType
  /** Optional comment about the decision */
  comment?: string
  /** Optional DID to credit as the creator. Only respected for admin_token authentication. */
  createdBy?: string
}

const hashUrlRule = 'urlRule'

export function isUrlRule<V>(v: V) {
  return is$typed(v, id, hashUrlRule)
}

export function validateUrlRule<V>(v: V) {
  return validate<UrlRule & V>(v, id, hashUrlRule)
}

/** A currently active URL safety rule */
export interface ActiveRule {
  $type?: 'tools.ozone.safelink.defs#activeRule'
  /** The URL or domain this rule applies to */
  url: string
  pattern: PatternType
  action: ActionType
  reason: ReasonType
  /** DID of the user who created this rule */
  createdBy: string
  createdAt: string
  /** Optional comment about the decision */
  comment?: string
}

const hashActiveRule = 'activeRule'

export function isActiveRule<V>(v: V) {
  return is$typed(v, id, hashActiveRule)
}

export function validateActiveRule<V>(v: V) {
  return validate<ActiveRule & V>(v, id, hashActiveRule)
}
