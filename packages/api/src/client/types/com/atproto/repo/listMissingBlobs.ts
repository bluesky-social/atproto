/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.repo.listMissingBlobs'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  blobs: RecordBlob[]
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

export interface RecordBlob {
  cid: string
  recordUri: string
  [k: string]: unknown
}

export function isRecordBlob(v: unknown): v is RecordBlob & {
  $type: $Type<'com.atproto.repo.listMissingBlobs', 'recordBlob'>
} {
  return is$typed(v, id, 'recordBlob')
}

export function validateRecordBlob(v: unknown) {
  return lexicons.validate(
    `${id}#recordBlob`,
    v,
  ) as ValidationResult<RecordBlob>
}
