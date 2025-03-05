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
const id = 'com.atproto.server.defs'

export interface InviteCode {
  $type?: 'com.atproto.server.defs#inviteCode'
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: InviteCodeUse[]
}

const hashInviteCode = 'inviteCode'

export function isInviteCode<V>(v: V) {
  return is$typed(v, id, hashInviteCode)
}

export function validateInviteCode<V>(v: V) {
  return validate<InviteCode & V>(v, id, hashInviteCode)
}

export interface InviteCodeUse {
  $type?: 'com.atproto.server.defs#inviteCodeUse'
  usedBy: string
  usedAt: string
}

const hashInviteCodeUse = 'inviteCodeUse'

export function isInviteCodeUse<V>(v: V) {
  return is$typed(v, id, hashInviteCodeUse)
}

export function validateInviteCodeUse<V>(v: V) {
  return validate<InviteCodeUse & V>(v, id, hashInviteCodeUse)
}
