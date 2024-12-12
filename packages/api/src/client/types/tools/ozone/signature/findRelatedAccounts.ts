/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ToolsOzoneSignatureDefs from './defs'

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
  [k: string]: unknown
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
  account: ComAtprotoAdminDefs.AccountView
  similarities?: ToolsOzoneSignatureDefs.SigDetail[]
  [k: string]: unknown
}

export function isRelatedAccount(v: unknown): v is RelatedAccount & {
  $type: $Type<'tools.ozone.signature.findRelatedAccounts', 'relatedAccount'>
} {
  return is$typed(v, id, 'relatedAccount')
}

export function validateRelatedAccount(v: unknown) {
  return lexicons.validate(
    `${id}#relatedAccount`,
    v,
  ) as ValidationResult<RelatedAccount>
}
