/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ToolsOzoneSignatureDefs from './defs'

export const id = 'tools.ozone.signature.findRelatedAccounts'

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

export function isRelatedAccount<V>(v: V) {
  return is$typed(v, id, 'relatedAccount')
}

export function validateRelatedAccount(v: unknown) {
  return lexicons.validate(
    `${id}#relatedAccount`,
    v,
  ) as ValidationResult<RelatedAccount>
}

export function isValidRelatedAccount<V>(
  v: V,
): v is V & $Typed<RelatedAccount> {
  return isRelatedAccount(v) && validateRelatedAccount(v).success
}
