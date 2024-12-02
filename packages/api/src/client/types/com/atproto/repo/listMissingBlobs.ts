/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'com.atproto.repo.listMissingBlobs'

export interface QueryParams {
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  blobs: RecordBlob[]
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
  $type?: $Type<'com.atproto.repo.listMissingBlobs', 'recordBlob'>
  cid: string
  recordUri: string
}

export function isRecordBlob<V>(v: V) {
  return is$typed(v, id, 'recordBlob')
}

export function validateRecordBlob(v: unknown) {
  return lexicons.validate(
    `${id}#recordBlob`,
    v,
  ) as ValidationResult<RecordBlob>
}

export function isValidRecordBlob<V>(v: V): v is V & $Typed<RecordBlob> {
  return isRecordBlob(v) && validateRecordBlob(v).success
}
