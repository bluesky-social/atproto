/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoServerDefs from '../server/defs'

export interface StatusAttr {
  applied: boolean
  ref?: string
  [k: string]: unknown
}

export function isStatusAttr(v: unknown): v is StatusAttr {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#statusAttr'
  )
}

export function validateStatusAttr(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#statusAttr', v)
}

export interface AccountView {
  did: string
  handle: string
  email?: string
  relatedRecords?: {}[]
  indexedAt: string
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invites?: ComAtprotoServerDefs.InviteCode[]
  invitesDisabled?: boolean
  emailConfirmedAt?: string
  inviteNote?: string
  [k: string]: unknown
}

export function isAccountView(v: unknown): v is AccountView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#accountView'
  )
}

export function validateAccountView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#accountView', v)
}

export interface RepoRef {
  did: string
  [k: string]: unknown
}

export function isRepoRef(v: unknown): v is RepoRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoRef'
  )
}

export function validateRepoRef(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoRef', v)
}

export interface RepoBlobRef {
  did: string
  cid: string
  recordUri?: string
  [k: string]: unknown
}

export function isRepoBlobRef(v: unknown): v is RepoBlobRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.defs#repoBlobRef'
  )
}

export function validateRepoBlobRef(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.defs#repoBlobRef', v)
}
