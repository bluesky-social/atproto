/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.identity.requestPlcOperationSignature'

export interface QueryParams {}

export type InputSchema = undefined

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
}

export interface Response {
  success: boolean
  headers: HeadersMap
}

export function toKnownErr(e: any) {
  return e
}
