/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface View {
  id: number
  action: 'com.atproto.admin.moderationAction#takedown' | (string & {})
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  createdAt: string
  reversal?: Reversal
  resolvedReportIds: number[]
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#view', v)
}

export interface Reversal {
  reason: string
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export function isReversal(v: unknown): v is Reversal {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.moderationAction#reversal'
  )
}

export function validateReversal(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.moderationAction#reversal', v)
}

/** Moderation action type: Takedown. Indicates that content should not be served by the PDS. */
export const TAKEDOWN = 'com.atproto.admin.moderationAction#takedown'
/** Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served. */
export const FLAG = 'com.atproto.admin.moderationAction#flag'
/** Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules. */
export const ACKNOWLEDGE = 'com.atproto.admin.moderationAction#acknowledge'
