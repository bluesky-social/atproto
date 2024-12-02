/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoServerDefs from '../server/defs'

export const id = 'com.atproto.admin.defs'

export interface StatusAttr {
  $type?: $Type<'com.atproto.admin.defs', 'statusAttr'>
  applied: boolean
  ref?: string
}

export function isStatusAttr<V>(v: V) {
  return is$typed(v, id, 'statusAttr')
}

export function validateStatusAttr(v: unknown) {
  return lexicons.validate(
    `${id}#statusAttr`,
    v,
  ) as ValidationResult<StatusAttr>
}

export function isValidStatusAttr<V>(v: V): v is V & $Typed<StatusAttr> {
  return isStatusAttr(v) && validateStatusAttr(v).success
}

export interface AccountView {
  $type?: $Type<'com.atproto.admin.defs', 'accountView'>
  did: string
  handle: string
  email?: string
  relatedRecords?: { [_ in string]: unknown }[]
  indexedAt: string
  invitedBy?: ComAtprotoServerDefs.InviteCode
  invites?: ComAtprotoServerDefs.InviteCode[]
  invitesDisabled?: boolean
  emailConfirmedAt?: string
  inviteNote?: string
  deactivatedAt?: string
  threatSignatures?: ThreatSignature[]
}

export function isAccountView<V>(v: V) {
  return is$typed(v, id, 'accountView')
}

export function validateAccountView(v: unknown) {
  return lexicons.validate(
    `${id}#accountView`,
    v,
  ) as ValidationResult<AccountView>
}

export function isValidAccountView<V>(v: V): v is V & $Typed<AccountView> {
  return isAccountView(v) && validateAccountView(v).success
}

export interface RepoRef {
  $type?: $Type<'com.atproto.admin.defs', 'repoRef'>
  did: string
}

export function isRepoRef<V>(v: V) {
  return is$typed(v, id, 'repoRef')
}

export function validateRepoRef(v: unknown) {
  return lexicons.validate(`${id}#repoRef`, v) as ValidationResult<RepoRef>
}

export function isValidRepoRef<V>(v: V): v is V & $Typed<RepoRef> {
  return isRepoRef(v) && validateRepoRef(v).success
}

export interface RepoBlobRef {
  $type?: $Type<'com.atproto.admin.defs', 'repoBlobRef'>
  did: string
  cid: string
  recordUri?: string
}

export function isRepoBlobRef<V>(v: V) {
  return is$typed(v, id, 'repoBlobRef')
}

export function validateRepoBlobRef(v: unknown) {
  return lexicons.validate(
    `${id}#repoBlobRef`,
    v,
  ) as ValidationResult<RepoBlobRef>
}

export function isValidRepoBlobRef<V>(v: V): v is V & $Typed<RepoBlobRef> {
  return isRepoBlobRef(v) && validateRepoBlobRef(v).success
}

export interface ThreatSignature {
  $type?: $Type<'com.atproto.admin.defs', 'threatSignature'>
  property: string
  value: string
}

export function isThreatSignature<V>(v: V) {
  return is$typed(v, id, 'threatSignature')
}

export function validateThreatSignature(v: unknown) {
  return lexicons.validate(
    `${id}#threatSignature`,
    v,
  ) as ValidationResult<ThreatSignature>
}

export function isValidThreatSignature<V>(
  v: V,
): v is V & $Typed<ThreatSignature> {
  return isThreatSignature(v) && validateThreatSignature(v).success
}
