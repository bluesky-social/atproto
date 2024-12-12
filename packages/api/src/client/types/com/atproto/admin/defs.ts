/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoServerDefs from '../server/defs'

const id = 'com.atproto.admin.defs'

export interface StatusAttr {
  applied: boolean
  ref?: string
  [k: string]: unknown
}

export function isStatusAttr(
  v: unknown,
): v is StatusAttr & { $type: $Type<'com.atproto.admin.defs', 'statusAttr'> } {
  return is$typed(v, id, 'statusAttr')
}

export function validateStatusAttr(v: unknown) {
  return lexicons.validate(
    `${id}#statusAttr`,
    v,
  ) as ValidationResult<StatusAttr>
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
  deactivatedAt?: string
  threatSignatures?: ThreatSignature[]
  [k: string]: unknown
}

export function isAccountView(v: unknown): v is AccountView & {
  $type: $Type<'com.atproto.admin.defs', 'accountView'>
} {
  return is$typed(v, id, 'accountView')
}

export function validateAccountView(v: unknown) {
  return lexicons.validate(
    `${id}#accountView`,
    v,
  ) as ValidationResult<AccountView>
}

export interface RepoRef {
  did: string
  [k: string]: unknown
}

export function isRepoRef(
  v: unknown,
): v is RepoRef & { $type: $Type<'com.atproto.admin.defs', 'repoRef'> } {
  return is$typed(v, id, 'repoRef')
}

export function validateRepoRef(v: unknown) {
  return lexicons.validate(`${id}#repoRef`, v) as ValidationResult<RepoRef>
}

export interface RepoBlobRef {
  did: string
  cid: string
  recordUri?: string
  [k: string]: unknown
}

export function isRepoBlobRef(v: unknown): v is RepoBlobRef & {
  $type: $Type<'com.atproto.admin.defs', 'repoBlobRef'>
} {
  return is$typed(v, id, 'repoBlobRef')
}

export function validateRepoBlobRef(v: unknown) {
  return lexicons.validate(
    `${id}#repoBlobRef`,
    v,
  ) as ValidationResult<RepoBlobRef>
}

export interface ThreatSignature {
  property: string
  value: string
  [k: string]: unknown
}

export function isThreatSignature(v: unknown): v is ThreatSignature & {
  $type: $Type<'com.atproto.admin.defs', 'threatSignature'>
} {
  return is$typed(v, id, 'threatSignature')
}

export function validateThreatSignature(v: unknown) {
  return lexicons.validate(
    `${id}#threatSignature`,
    v,
  ) as ValidationResult<ThreatSignature>
}
