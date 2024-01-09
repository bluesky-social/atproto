/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface InviteCode {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: InviteCodeUse[]
  [k: string]: unknown
}

export function isInviteCode(v: unknown): v is InviteCode {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.defs#inviteCode'
  )
}

export function validateInviteCode(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.defs#inviteCode', v)
}

export interface InviteCodeUse {
  usedBy: string
  usedAt: string
  [k: string]: unknown
}

export function isInviteCodeUse(v: unknown): v is InviteCodeUse {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.server.defs#inviteCodeUse'
  )
}

export function validateInviteCodeUse(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.server.defs#inviteCodeUse', v)
}
