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

export type EventType = 'addRule' | 'updateRule' | 'removeRule' | (string & {})
export type PatternType = 'domain' | 'url' | (string & {})
export type ActionType = 'block' | 'warn' | 'whitelist' | (string & {})
export type ReasonType = 'csam' | 'spam' | 'phishing' | 'none' | (string & {})

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
  /** DID of the user added the rule. */
  createdBy: string
  /** Timestamp when the rule was created */
  createdAt: string
  /** Timestamp when the rule was last updated */
  updatedAt: string
}

const hashUrlRule = 'urlRule'

export function isUrlRule<V>(v: V) {
  return is$typed(v, id, hashUrlRule)
}

export function validateUrlRule<V>(v: V) {
  return validate<UrlRule & V>(v, id, hashUrlRule)
}
