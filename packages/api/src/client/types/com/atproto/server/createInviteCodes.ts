/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.server.createInviteCodes'

export interface QueryParams {}

export interface InputSchema {
  codeCount: number
  useCount: number
  forAccounts?: string[]
}

export interface OutputSchema {
  codes: AccountCodes[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface AccountCodes {
  $type?: $Type<'com.atproto.server.createInviteCodes', 'accountCodes'>
  account: string
  codes: string[]
}

export function isAccountCodes<V>(v: V) {
  return is$typed(v, id, 'accountCodes')
}

export function validateAccountCodes(v: unknown) {
  return lexicons.validate(
    `${id}#accountCodes`,
    v,
  ) as ValidationResult<AccountCodes>
}

export function isValidAccountCodes<V>(v: V): v is V & $Typed<AccountCodes> {
  return isAccountCodes(v) && validateAccountCodes(v).success
}
