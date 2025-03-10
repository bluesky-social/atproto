/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
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
const id = 'com.atproto.server.createInviteCodes'

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
  $type?: 'com.atproto.server.createInviteCodes#accountCodes'
  account: string
  codes: string[]
}

const hashAccountCodes = 'accountCodes'

export function isAccountCodes<V>(v: V) {
  return is$typed(v, id, hashAccountCodes)
}

export function validateAccountCodes<V>(v: V) {
  return validate<AccountCodes & V>(v, id, hashAccountCodes)
}
