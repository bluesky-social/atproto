/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.server.defs'

export interface InviteCode {
  $type?: $Type<'com.atproto.server.defs', 'inviteCode'>
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: InviteCodeUse[]
}

export function isInviteCode<V>(v: V) {
  return is$typed(v, id, 'inviteCode')
}

export function validateInviteCode(v: unknown) {
  return lexicons.validate(
    `${id}#inviteCode`,
    v,
  ) as ValidationResult<InviteCode>
}

export function isValidInviteCode<V>(v: V): v is V & $Typed<InviteCode> {
  return isInviteCode(v) && validateInviteCode(v).success
}

export interface InviteCodeUse {
  $type?: $Type<'com.atproto.server.defs', 'inviteCodeUse'>
  usedBy: string
  usedAt: string
}

export function isInviteCodeUse<V>(v: V) {
  return is$typed(v, id, 'inviteCodeUse')
}

export function validateInviteCodeUse(v: unknown) {
  return lexicons.validate(
    `${id}#inviteCodeUse`,
    v,
  ) as ValidationResult<InviteCodeUse>
}

export function isValidInviteCodeUse<V>(v: V): v is V & $Typed<InviteCodeUse> {
  return isInviteCodeUse(v) && validateInviteCodeUse(v).success
}
