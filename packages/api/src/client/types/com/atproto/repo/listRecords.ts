/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.repo.listRecords'

export interface QueryParams {
  /** The handle or DID of the repo. */
  repo: string
  /** The NSID of the record type. */
  collection: string
  /** The number of records to return. */
  limit?: number
  cursor?: string
  /** DEPRECATED: The lowest sort-ordered rkey to start from (exclusive) */
  rkeyStart?: string
  /** DEPRECATED: The highest sort-ordered rkey to stop at (exclusive) */
  rkeyEnd?: string
  /** Flag to reverse the order of the returned records. */
  reverse?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  records: Record[]
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

export interface Record {
  uri: string
  cid: string
  value: {}
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'com.atproto.repo.listRecords', 'record'> } {
  return is$typed(v, id, 'record')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#record`, v) as ValidationResult<Record>
}
