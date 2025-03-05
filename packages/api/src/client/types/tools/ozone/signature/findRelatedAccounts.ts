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
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs.js'
import type * as ToolsOzoneSignatureDefs from './defs.js'

const is$typed = _is$typed,
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
  $type?: 'tools.ozone.signature.findRelatedAccounts#relatedAccount'
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
