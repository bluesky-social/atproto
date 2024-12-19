/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import type * as ToolsOzoneSignatureDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'tools.ozone.signature.findRelatedAccounts'

export interface QueryParams {
  did: string
  cursor?: string
  limit?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: RelatedAccount[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface RelatedAccount {
  $type?: $Type<'tools.ozone.signature.findRelatedAccounts', 'relatedAccount'>
  account: ComAtprotoAdminDefs.AccountView
  similarities?: ToolsOzoneSignatureDefs.SigDetail[]
}

const hashRelatedAccount = 'relatedAccount'

export function isRelatedAccount<V>(v: V) {
  return is$typed(v, id, hashRelatedAccount)
}

export function validateRelatedAccount<V>(v: V) {
  return validate<RelatedAccount & V>(v, id, hashRelatedAccount)
}

export function isValidRelatedAccount<V>(v: V) {
  return isValid<RelatedAccount>(v, id, hashRelatedAccount)
}
