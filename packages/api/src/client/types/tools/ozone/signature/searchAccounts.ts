/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'

const id = 'tools.ozone.signature.searchAccounts'

export interface QueryParams {
  values: string[]
  cursor?: string
  limit?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: ComAtprotoAdminDefs.AccountView[]
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
