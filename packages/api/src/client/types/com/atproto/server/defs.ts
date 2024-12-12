/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.server.defs'

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

export function isInviteCode(
  v: unknown,
): v is InviteCode & { $type: $Type<'com.atproto.server.defs', 'inviteCode'> } {
  return is$typed(v, id, 'inviteCode')
}

export function validateInviteCode(v: unknown) {
  return lexicons.validate(
    `${id}#inviteCode`,
    v,
  ) as ValidationResult<InviteCode>
}

export interface InviteCodeUse {
  usedBy: string
  usedAt: string
  [k: string]: unknown
}

export function isInviteCodeUse(v: unknown): v is InviteCodeUse & {
  $type: $Type<'com.atproto.server.defs', 'inviteCodeUse'>
} {
  return is$typed(v, id, 'inviteCodeUse')
}

export function validateInviteCodeUse(v: unknown) {
  return lexicons.validate(
    `${id}#inviteCodeUse`,
    v,
  ) as ValidationResult<InviteCodeUse>
}
