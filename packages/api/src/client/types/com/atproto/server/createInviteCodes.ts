/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.server.createInviteCodes'

export interface QueryParams {}

export interface InputSchema {
  codeCount: number
  useCount: number
  forAccounts?: string[]
  [k: string]: unknown
}

export interface OutputSchema {
  codes: AccountCodes[]
  [k: string]: unknown
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
  account: string
  codes: string[]
  [k: string]: unknown
}

export function isAccountCodes(v: unknown): v is AccountCodes & {
  $type: $Type<'com.atproto.server.createInviteCodes', 'accountCodes'>
} {
  return is$typed(v, id, 'accountCodes')
}

export function validateAccountCodes(v: unknown) {
  return lexicons.validate(
    `${id}#accountCodes`,
    v,
  ) as ValidationResult<AccountCodes>
}
